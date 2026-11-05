import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Botao } from "../componentes";
import type { Abas, Rotas } from "../navegacao";
import { cor, raio, toqueMinimo } from "../tema";

type Props = CompositeScreenProps<BottomTabScreenProps<Abas, "Inicio">, NativeStackScreenProps<Rotas>>;

export default function Inicio({ navigation }: Props) {
  const [busca, setBusca] = useState("");
  const buscar = () => navigation.navigate("Guia", { busca: busca.trim() });

  return (
    <ScrollView contentContainerStyle={e.tela}>
      <Text style={e.titulo} accessibilityRole="header">Como descartar?</Text>
      <Text style={e.texto}>
        Descubra como descartar cada tipo de resíduo e encontre o ponto de coleta mais próximo em Araçatuba e região.
      </Text>
      <View style={e.busca}>
        <TextInput
          style={e.campo}
          value={busca}
          onChangeText={setBusca}
          onSubmitEditing={buscar}
          returnKeyType="search"
          placeholder="Ex.: pilha, óleo de cozinha"
          accessibilityLabel="Buscar item para descartar"
        />
        <Botao titulo="Buscar" aoTocar={buscar} />
      </View>
      <Botao titulo="Tirar foto do item" aoTocar={() => navigation.navigate("Foto")} />
      <Botao titulo="Pontos de coleta perto de mim" aoTocar={() => navigation.navigate("Mapa")} />
      <Botao titulo="Ver guia completo" secundario aoTocar={() => navigation.navigate("Guia")} />
    </ScrollView>
  );
}

const e = StyleSheet.create({
  tela: { padding: 16, gap: 16, backgroundColor: cor.fundo, flexGrow: 1 },
  titulo: { fontSize: 26, fontWeight: "700", color: cor.cabecalho },
  texto: { fontSize: 16, color: cor.texto, lineHeight: 24 },
  busca: { gap: 8 },
  campo: {
    minHeight: toqueMinimo, borderWidth: 1, borderColor: cor.textoSuave, borderRadius: raio,
    paddingHorizontal: 12, fontSize: 16, color: cor.texto,
  },
});
