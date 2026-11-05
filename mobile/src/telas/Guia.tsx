import { useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api } from "../api";
import { Carregando, Erro, Vazio } from "../componentes";
import type { Abas, Rotas } from "../navegacao";
import { cor, raio, toqueMinimo } from "../tema";
import { useConsulta } from "../useConsulta";

type Props = CompositeScreenProps<BottomTabScreenProps<Abas, "Guia">, NativeStackScreenProps<Rotas>>;

export default function Guia({ navigation, route }: Props) {
  const [texto, setTexto] = useState(route.params?.busca ?? "");
  const [busca, setBusca] = useState(texto);
  const [categoriaId, setCategoriaId] = useState<number>();

  useEffect(() => {
    if (route.params?.busca !== undefined) setTexto(route.params.busca);
  }, [route.params]); // novo a cada navegação: repete a busca mesmo com o mesmo texto

  // Espera o usuário parar de digitar antes de consultar.
  useEffect(() => {
    const t = setTimeout(() => setBusca(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  const categorias = useConsulta((s) => api.categorias(s), []);
  const materiais = useConsulta((s) => api.materiais({ busca, categoriaId }, s), [busca, categoriaId]);

  return (
    <View style={e.tela}>
      <TextInput
        style={e.campo}
        value={texto}
        onChangeText={setTexto}
        placeholder="Buscar item (ex.: pilha)"
        accessibilityLabel="Buscar item"
        returnKeyType="search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={e.chips} contentContainerStyle={{ gap: 8 }}>
        {[{ id: undefined as number | undefined, nome: "Todos" }, ...(categorias.dados ?? [])].map((c) => {
          const ativo = categoriaId === c.id;
          return (
            <Pressable
              key={c.id ?? "todos"}
              onPress={() => setCategoriaId(c.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: ativo }}
              style={[e.chip, ativo && e.chipAtivo]}
            >
              <Text style={[e.chipTexto, ativo && { color: "#fff" }]}>{c.nome}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {materiais.carregando ? <Carregando /> : materiais.erro ? (
        <Erro mensagem={materiais.erro} tentar={materiais.tentar} />
      ) : (
        <FlatList
          data={materiais.dados}
          keyExtractor={(m) => String(m.id)}
          ListEmptyComponent={<Vazio mensagem="Nenhum item encontrado. Tente outra palavra." />}
          renderItem={({ item }) => (
            <Pressable
              style={e.item}
              accessibilityRole="button"
              onPress={() => navigation.navigate("Material", { id: item.id, nome: item.nome })}
            >
              <Text style={e.itemNome}>{item.nome}</Text>
              <Text style={e.itemCat}>
                {item.categoria}{item.perigoso ? " · Resíduo perigoso" : ""}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const e = StyleSheet.create({
  tela: { flex: 1, padding: 16, gap: 12, backgroundColor: cor.fundo },
  campo: {
    minHeight: toqueMinimo, borderWidth: 1, borderColor: cor.textoSuave, borderRadius: raio,
    paddingHorizontal: 12, fontSize: 16, color: cor.texto,
  },
  chips: { flexGrow: 0 },
  chip: {
    minHeight: toqueMinimo, paddingHorizontal: 14, justifyContent: "center",
    borderWidth: 1, borderColor: cor.primaria, borderRadius: raio,
  },
  chipAtivo: { backgroundColor: cor.primaria },
  chipTexto: { color: cor.primaria, fontWeight: "600" },
  item: { minHeight: toqueMinimo, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: cor.borda },
  itemNome: { fontSize: 17, color: cor.texto, fontWeight: "600" },
  itemCat: { fontSize: 14, color: cor.textoSuave },
});
