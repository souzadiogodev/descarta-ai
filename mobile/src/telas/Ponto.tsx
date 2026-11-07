import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, ErroApi, formatarDistancia, urlGoogleMaps, urlWaze, type MotivoReporte } from "../api";
import { Botao } from "../componentes";
import type { Rotas } from "../navegacao";
import { cor, raio, toqueMinimo } from "../tema";

const MOTIVOS: { valor: MotivoReporte; texto: string }[] = [
  { valor: "Fechado", texto: "O ponto fechou ou não existe mais" },
  { valor: "EnderecoErrado", texto: "O endereço ou a localização está errado" },
  { valor: "NaoAceitaMaterial", texto: "Não aceita algum material listado" },
  { valor: "Outro", texto: "Outro problema" },
];

export default function Ponto({ route }: NativeStackScreenProps<Rotas, "Ponto">) {
  const { ponto: p } = route.params;
  const [reportando, setReportando] = useState(false);

  return (
    <ScrollView contentContainerStyle={e.tela} keyboardShouldPersistTaps="handled">
      <Text style={e.titulo} accessibilityRole="header">{p.nome}</Text>
      <Text style={e.texto}>{p.endereco}</Text>
      <Text style={e.suave}>A {formatarDistancia(p.distanciaMetros)} do local de busca</Text>
      <Text style={e.subtitulo} accessibilityRole="header">Materiais aceitos</Text>
      {p.materiais.length
        ? p.materiais.map((m) => <Text key={m} style={e.texto}>• {m}</Text>)
        : <Text style={e.suave}>Não informado.</Text>}

      <Text style={e.subtitulo} accessibilityRole="header">Como chegar</Text>
      <Botao titulo="Abrir no Google Maps" aoTocar={() => Linking.openURL(urlGoogleMaps(p.lat, p.lng))} />
      <Botao titulo="Abrir no Waze" secundario aoTocar={() => Linking.openURL(urlWaze(p.lat, p.lng))} />

      {reportando
        ? <FormReporte pontoId={p.id} aoFechar={() => setReportando(false)} />
        : (
          <Pressable accessibilityRole="button" style={e.link} onPress={() => setReportando(true)}>
            <Text style={e.linkTexto}>Alguma informação está errada? Avise a gente</Text>
          </Pressable>
        )}
    </ScrollView>
  );
}

/** RF19: o aviso é anônimo e vai para o painel do administrador. */
export function FormReporte({ pontoId, aoFechar }: { pontoId: string; aoFechar: () => void }) {
  const [motivo, setMotivo] = useState<MotivoReporte>();
  const [comentario, setComentario] = useState("");
  const [estado, setEstado] = useState<"editando" | "enviando" | "enviado">("editando");
  const [erro, setErro] = useState<string>();

  if (estado === "enviado")
    return (
      <View style={e.caixa} accessibilityRole="alert">
        <Text style={e.texto}>Obrigado! Vamos conferir a informação.</Text>
        <Botao titulo="Fechar" secundario aoTocar={aoFechar} />
      </View>
    );

  const enviar = async () => {
    if (!motivo) return setErro("Escolha o que está errado.");
    if (motivo === "Outro" && !comentario.trim()) return setErro("Conte o que está errado.");
    setErro(undefined);
    setEstado("enviando");
    try {
      await api.reportar(pontoId, motivo, comentario.trim() || undefined);
      setEstado("enviado");
    } catch (x) {
      setErro(x instanceof ErroApi && x.status === 429
        ? "Muitos avisos em pouco tempo. Tente de novo em um minuto."
        : "Não foi possível enviar. Verifique sua conexão e tente de novo.");
      setEstado("editando");
    }
  };

  return (
    <View style={e.caixa}>
      <Text style={e.subtitulo} accessibilityRole="header">O que está errado?</Text>
      <View accessibilityRole="radiogroup">
        {MOTIVOS.map((m) => (
          <Pressable key={m.valor} accessibilityRole="radio" accessibilityState={{ checked: motivo === m.valor }}
            onPress={() => setMotivo(m.valor)} style={e.opcao}>
            <View style={[e.bolinha, motivo === m.valor && e.bolinhaMarcada]} />
            <Text style={e.texto}>{m.texto}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={e.rotulo}>Detalhes {motivo !== "Outro" && "(opcional)"}</Text>
      <TextInput style={e.entrada} value={comentario} onChangeText={setComentario} maxLength={500} multiline
        accessibilityLabel="Detalhes do problema" placeholder="Não escreva dados pessoais." />
      {erro && <Text style={e.erro} accessibilityRole="alert">{erro}</Text>}
      <Botao titulo={estado === "enviando" ? "Enviando…" : "Enviar aviso"} aoTocar={estado === "enviando" ? () => {} : enviar} />
      <Botao titulo="Cancelar" secundario aoTocar={aoFechar} />
    </View>
  );
}

const e = StyleSheet.create({
  tela: { padding: 16, gap: 10, backgroundColor: cor.fundo, flexGrow: 1 },
  titulo: { fontSize: 22, fontWeight: "700", color: cor.cabecalho },
  subtitulo: { fontSize: 18, fontWeight: "700", color: cor.cabecalho, marginTop: 8 },
  texto: { fontSize: 16, color: cor.texto, flexShrink: 1 },
  suave: { fontSize: 15, color: cor.textoSuave },
  link: { minHeight: toqueMinimo, justifyContent: "center", marginTop: 8 },
  linkTexto: { color: cor.primaria, fontSize: 16, fontWeight: "600", textDecorationLine: "underline" },
  caixa: { gap: 10, borderTopWidth: 1, borderColor: cor.borda, paddingTop: 12, marginTop: 8 },
  opcao: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: toqueMinimo },
  bolinha: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: cor.textoSuave },
  bolinhaMarcada: { borderColor: cor.primaria, borderWidth: 7 },
  rotulo: { fontSize: 16, fontWeight: "600", color: cor.texto },
  entrada: { minHeight: 80, borderWidth: 2, borderColor: cor.textoSuave, borderRadius: raio, padding: 10, fontSize: 16, textAlignVertical: "top", color: cor.texto },
  erro: { color: cor.perigo, fontWeight: "600", fontSize: 15 },
});
