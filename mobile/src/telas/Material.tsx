import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api } from "../api";
import { Botao, Carregando, Erro } from "../componentes";
import type { Rotas } from "../navegacao";
import { cor, raio } from "../tema";
import { useConsulta } from "../useConsulta";

export default function Material({ route, navigation }: NativeStackScreenProps<Rotas, "Material">) {
  const { id } = route.params;
  const { dados: m, erro, carregando, tentar } = useConsulta((s) => api.material(id, s), [id]);

  if (carregando) return <Carregando />;
  if (erro || !m) return <Erro mensagem={erro ?? "Item não encontrado."} tentar={tentar} />;

  return (
    <ScrollView contentContainerStyle={e.tela}>
      <Text style={e.categoria}>{m.categoria}</Text>
      {m.perigoso && (
        <View style={e.alerta} accessibilityRole="alert">
          <Text style={e.alertaTexto}>Resíduo perigoso: não descarte no lixo comum.</Text>
        </View>
      )}
      <Text style={e.subtitulo} accessibilityRole="header">Como descartar</Text>
      <Text style={e.texto}>{m.instrucoes}</Text>
      {m.cuidados ? (
        <>
          <Text style={e.subtitulo} accessibilityRole="header">Cuidados</Text>
          <Text style={e.texto}>{m.cuidados}</Text>
        </>
      ) : null}
      <Botao
        titulo="Onde descartar"
        aoTocar={() => navigation.navigate("Abas", { screen: "Mapa", params: { materialId: m.id, materialNome: m.nome } })}
      />
    </ScrollView>
  );
}

const e = StyleSheet.create({
  tela: { padding: 16, gap: 12, backgroundColor: cor.fundo, flexGrow: 1 },
  categoria: { fontSize: 14, color: cor.textoSuave },
  subtitulo: { fontSize: 18, fontWeight: "700", color: cor.cabecalho, marginTop: 8 },
  texto: { fontSize: 16, color: cor.texto, lineHeight: 24 },
  alerta: { backgroundColor: cor.alertaFundo, borderLeftWidth: 4, borderLeftColor: cor.alerta, padding: 12, borderRadius: raio },
  alertaTexto: { color: cor.alerta, fontWeight: "600" },
});
