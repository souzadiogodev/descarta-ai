import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, ErroApi, foiCancelada, type Identificacao, type Sugestao } from "../api";
import { Botao } from "../componentes";
import type { Rotas } from "../navegacao";
import { cor, raio, toqueMinimo } from "../tema";

type Estado =
  | { etapa: "inicio"; aviso?: string }
  | { etapa: "enviando"; uri: string }
  | { etapa: "resultado"; uri: string; resultado: Identificacao }
  | { etapa: "erro"; uri: string; mensagem: string };

/** Lado maior da foto enviada: suficiente para reconhecer o objeto e bem abaixo do limite de 5 MB. */
const LADO_MAXIMO = 1280;

export const mensagemDeErro = (e: unknown) =>
  e instanceof ErroApi && e.status === 429 ? "Muitas fotos em pouco tempo. Aguarde um minuto e tente de novo."
  : e instanceof ErroApi && e.status === 503 ? "A identificação por foto está indisponível agora. Busque o item pelo nome."
  : e instanceof ErroApi && e.status === 413 ? "A imagem é grande demais. Tente outra foto."
  : e instanceof ErroApi && e.status === 400 ? "Formato de imagem não suportado. Use JPEG ou PNG."
  : "Não foi possível falar com o servidor. Verifique sua conexão.";

export const porcentagem = (c: number) => `${Math.round(c * 100)}%`;

export default function Foto({ navigation }: NativeStackScreenProps<Rotas, "Foto">) {
  const [estado, setEstado] = useState<Estado>({ etapa: "inicio" });
  const controle = useRef<AbortController>(null);
  useEffect(() => () => controle.current?.abort(), []); // sair da tela cancela o envio

  async function escolher(origem: "camera" | "galeria") {
    const permissao = origem === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      setEstado({ etapa: "inicio", aviso: origem === "camera"
        ? "Sem acesso à câmera. Libere nas configurações do aparelho ou escolha da galeria."
        : "Sem acesso às fotos. Libere nas configurações do aparelho ou use a câmera." });
      return;
    }
    const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, exif: false };
    const escolha = origem === "camera"
      ? await ImagePicker.launchCameraAsync(opcoes)
      : await ImagePicker.launchImageLibraryAsync(opcoes);
    if (escolha.canceled || !escolha.assets[0]) return;
    await enviar(escolha.assets[0]);
  }

  async function enviar(foto: ImagePicker.ImagePickerAsset) {
    setEstado({ etapa: "enviando", uri: foto.uri });
    controle.current?.abort();
    controle.current = new AbortController();
    try {
      // Reduz e regrava como JPEG: menos dados móveis e sem metadados (como a localização da foto).
      const contexto = ImageManipulator.manipulate(foto.uri);
      if (Math.max(foto.width, foto.height) > LADO_MAXIMO)
        contexto.resize(foto.width >= foto.height ? { width: LADO_MAXIMO } : { height: LADO_MAXIMO });
      const imagem = await (await contexto.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

      const resultado = await api.identificar(
        { uri: imagem.uri, tipo: "image/jpeg", nome: "foto.jpg" }, controle.current.signal);
      setEstado({ etapa: "resultado", uri: foto.uri, resultado });
    } catch (e) {
      if (foiCancelada(e)) return;
      setEstado({ etapa: "erro", uri: foto.uri, mensagem: mensagemDeErro(e) });
    }
  }

  function confirmar(id: number, s: Sugestao) {
    // A confirmação só alimenta a estatística de acerto: falhar não deve travar o usuário.
    api.confirmar(id, s.materialId).catch(() => undefined);
    navigation.replace("Material", { id: s.materialId, nome: s.nome });
  }

  return (
    <ScrollView contentContainerStyle={e.tela}>
      {estado.etapa === "inicio" && (
        <>
          <Text style={e.texto}>
            Tire uma foto do item ou escolha uma da galeria. Vamos sugerir o que ele é para você confirmar.
          </Text>
          <View style={e.privacidade}>
            <Text style={e.privTitulo}>Sua privacidade</Text>
            <Text style={e.privTexto}>
              A foto é enviada só para identificar o item, por um serviço de inteligência artificial (Google Gemini), e não é guardada.
              Evite fotografar pessoas, documentos ou placas de carro.
            </Text>
          </View>
          {estado.aviso && <Text style={e.aviso} accessibilityRole="alert">{estado.aviso}</Text>}
          <Botao titulo="Tirar foto" aoTocar={() => escolher("camera")} />
          <Botao titulo="Escolher da galeria" secundario aoTocar={() => escolher("galeria")} />
        </>
      )}

      {estado.etapa !== "inicio" && (
        <Image source={{ uri: estado.uri }} style={e.foto} accessibilityLabel="Foto escolhida" resizeMode="cover" />
      )}

      {estado.etapa === "enviando" && (
        <View style={e.carregando} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={cor.primaria} />
          <Text style={e.texto}>Identificando o item…</Text>
        </View>
      )}

      {estado.etapa === "erro" && (
        <>
          <Text style={e.aviso} accessibilityRole="alert">{estado.mensagem}</Text>
          <Botao titulo="Tentar outra foto" aoTocar={() => setEstado({ etapa: "inicio" })} />
          <Botao titulo="Buscar pelo nome" secundario aoTocar={() => navigation.navigate("Abas", { screen: "Guia" })} />
        </>
      )}

      {estado.etapa === "resultado" && (
        estado.resultado.sugestoes.length === 0 ? (
          <>
            <Text style={e.texto}>Não conseguimos reconhecer o item. Tente uma foto mais próxima ou busque pelo nome.</Text>
            <Botao titulo="Tentar outra foto" aoTocar={() => setEstado({ etapa: "inicio" })} />
            <Botao titulo="Buscar pelo nome" secundario aoTocar={() => navigation.navigate("Abas", { screen: "Guia" })} />
          </>
        ) : (
          <>
            <Text style={e.subtitulo} accessibilityRole="header">É algum destes?</Text>
            {estado.resultado.sugestoes.map((s) => (
              <Pressable
                key={s.materialId}
                style={({ pressed }) => [e.sugestao, pressed && { backgroundColor: cor.primariaSuave }]}
                accessibilityRole="button"
                accessibilityLabel={`${s.nome}, ${s.categoria}, confiança ${porcentagem(s.confianca)}`}
                onPress={() => confirmar(estado.resultado.id, s)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={e.sugNome}>{s.nome}</Text>
                  <Text style={e.sugInfo}>{s.categoria}{s.perigoso ? " · Resíduo perigoso" : ""}</Text>
                </View>
                <Text style={e.sugConfianca}>{porcentagem(s.confianca)}</Text>
              </Pressable>
            ))}
            <Botao titulo="Não é nenhum destes" secundario aoTocar={() => navigation.navigate("Abas", { screen: "Guia" })} />
          </>
        )
      )}
    </ScrollView>
  );
}

const e = StyleSheet.create({
  tela: { padding: 16, gap: 14, backgroundColor: cor.fundo, flexGrow: 1 },
  texto: { fontSize: 16, color: cor.texto, lineHeight: 24 },
  subtitulo: { fontSize: 18, fontWeight: "700", color: cor.cabecalho },
  privacidade: { backgroundColor: cor.superficie2, borderLeftWidth: 4, borderLeftColor: cor.primaria, padding: 12, borderRadius: raio, gap: 4 },
  privTitulo: { fontWeight: "700", color: cor.cabecalho },
  privTexto: { color: cor.texto, lineHeight: 22 },
  aviso: { backgroundColor: cor.alertaFundo, color: cor.alerta, padding: 12, borderRadius: raio },
  foto: { width: "100%", aspectRatio: 4 / 3, borderRadius: raio, backgroundColor: cor.superficie2 },
  carregando: { alignItems: "center", gap: 8, paddingVertical: 16 },
  sugestao: {
    minHeight: toqueMinimo, flexDirection: "row", alignItems: "center", gap: 12, padding: 12,
    borderWidth: 1, borderColor: cor.borda, borderRadius: raio,
  },
  sugNome: { fontSize: 17, fontWeight: "600", color: cor.texto },
  sugInfo: { fontSize: 14, color: cor.textoSuave },
  sugConfianca: { fontSize: 16, fontWeight: "700", color: cor.primaria },
});
