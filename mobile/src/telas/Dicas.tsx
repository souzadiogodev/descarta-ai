import { ScrollView, StyleSheet, Text, View } from "react-native";
import { DICAS } from "../dicas";
import { cor } from "../tema";

export default function Dicas() {
  return (
    <ScrollView contentContainerStyle={e.tela}>
      <Text style={e.lead}>Pequenos hábitos que evitam a contaminação do solo e da água em Araçatuba e região.</Text>
      {DICAS.map((d, i) => (
        <View key={d.titulo} style={e.dica}>
          <Text style={e.titulo} accessibilityRole="header">{i + 1}. {d.titulo}</Text>
          <Text style={e.texto}>{d.texto}</Text>
        </View>
      ))}
      <Text style={e.fonte}>
        Fontes: Política Nacional de Resíduos Sólidos (Lei nº 12.305/2010), Ministério do Meio Ambiente,
        Resolução CONAMA nº 401/2008 e Decreto nº 10.388/2020.
      </Text>
    </ScrollView>
  );
}

const e = StyleSheet.create({
  tela: { padding: 16, gap: 16, backgroundColor: cor.fundo },
  lead: { fontSize: 16, color: cor.textoSuave },
  dica: { gap: 6, borderBottomWidth: 1, borderBottomColor: cor.borda, paddingBottom: 14 },
  titulo: { fontSize: 18, fontWeight: "700", color: cor.cabecalho },
  texto: { fontSize: 16, color: cor.texto, lineHeight: 23 },
  fonte: { fontSize: 13, color: cor.textoSuave },
});
