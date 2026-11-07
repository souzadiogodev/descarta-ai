import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, UrlTile } from "react-native-maps";
import * as Location from "expo-location";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, CENTRO_PADRAO, formatarDistancia } from "../api";
import { Botao, Carregando, Erro } from "../componentes";
import type { Abas, Rotas } from "../navegacao";
import { cor, raio, toqueMinimo } from "../tema";
import { useConsulta } from "../useConsulta";

type Props = CompositeScreenProps<BottomTabScreenProps<Abas, "Mapa">, NativeStackScreenProps<Rotas>>;
const RAIOS = [2, 5, 10, 20, 50];
// Os servidores do OpenStreetMap bloqueiam tiles pedidos por apps; o MapTiler (plano grátis) serve
// os mesmos dados do OSM. A chave vai dentro do app de qualquer jeito, então não é segredo.
const CHAVE_MAPA = process.env.EXPO_PUBLIC_MAPTILER_CHAVE ?? "";
const TILES = `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${CHAVE_MAPA}`;

export default function Mapa({ navigation, route }: Props) {
  const [origem, setOrigem] = useState(CENTRO_PADRAO);
  const [usandoGps, setUsandoGps] = useState(false);
  const [aviso, setAviso] = useState<string>();
  const [raioKm, setRaioKm] = useState(10);
  const [materialId, setMaterialId] = useState(route.params?.materialId);
  const mapa = useRef<MapView>(null);

  // Depende do objeto params (novo a cada navegação): reaplica o filtro mesmo que o id seja o mesmo
  // de antes, como quando o usuário limpou o filtro e voltou a tocar "Onde descartar".
  useEffect(() => { setMaterialId(route.params?.materialId); }, [route.params]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setAviso("Localização não liberada. Mostrando pontos a partir do centro de Araçatuba.");
        return;
      }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setOrigem({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUsandoGps(true);
      } catch {
        setAviso("Não foi possível obter sua localização. Mostrando a partir do centro de Araçatuba.");
      }
    })();
  }, []);

  const pontos = useConsulta(
    (s) => api.proximos({ lat: origem.lat, lng: origem.lng, raio: raioKm * 1000, materialId }, s),
    [origem.lat, origem.lng, raioKm, materialId],
  );

  // Enquadra a origem e os pontos encontrados.
  useEffect(() => {
    const coords = [
      { latitude: origem.lat, longitude: origem.lng },
      ...(pontos.dados ?? []).map((p) => ({ latitude: p.lat, longitude: p.lng })),
    ];
    mapa.current?.fitToCoordinates(coords, { edgePadding: { top: 40, bottom: 40, left: 40, right: 40 }, animated: true });
  }, [pontos.dados, origem]);

  const proximoRaio = RAIOS[RAIOS.indexOf(raioKm) + 1];

  return (
    <View style={e.tela}>
      <MapView
        ref={mapa}
        style={e.mapa}
        mapType="none"
        showsUserLocation={usandoGps}
        initialRegion={{ latitude: origem.lat, longitude: origem.lng, latitudeDelta: 0.1, longitudeDelta: 0.1 }}
      >
        <UrlTile urlTemplate={TILES} maximumZ={19} shouldReplaceMapContent />
        {pontos.dados?.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            title={p.nome}
            description={formatarDistancia(p.distanciaMetros)}
            pinColor={cor.primaria}
            onCalloutPress={() => navigation.navigate("Ponto", { ponto: p })}
          />
        ))}
      </MapView>
      <Text style={e.creditos}>© MapTiler · © colaboradores do OpenStreetMap</Text>

      <View style={e.painel}>
        {aviso && <Text style={e.aviso}>{aviso}</Text>}
        {materialId !== undefined && (
          <View style={e.filtro}>
            <Text style={e.texto}>Aceita: {route.params?.materialNome ?? "material escolhido"}</Text>
            <Pressable accessibilityRole="button" style={e.limpar} onPress={() => setMaterialId(undefined)}>
              <Text style={{ color: cor.primaria, fontWeight: "600" }}>Limpar filtro</Text>
            </Pressable>
          </View>
        )}
        <View style={e.raios} accessibilityLabel="Raio de busca">
          {RAIOS.map((r) => (
            <Pressable
              key={r}
              accessibilityRole="button"
              accessibilityState={{ selected: r === raioKm }}
              accessibilityLabel={`${r} quilômetros`}
              onPress={() => setRaioKm(r)}
              style={[e.raio, r === raioKm && e.raioAtivo]}
            >
              <Text style={[e.raioTexto, r === raioKm && { color: "#fff" }]}>{r} km</Text>
            </Pressable>
          ))}
        </View>

        {pontos.carregando ? <Carregando /> : pontos.erro ? (
          <Erro mensagem={pontos.erro} tentar={pontos.tentar} />
        ) : (
          <FlatList
            data={pontos.dados}
            keyExtractor={(p) => p.id}
            ListEmptyComponent={
              <View style={{ gap: 8, paddingVertical: 12 }}>
                <Text style={e.texto}>Nenhum ponto neste raio.</Text>
                {proximoRaio && <Botao titulo="Aumentar o raio" aoTocar={() => setRaioKm(proximoRaio)} />}
              </View>
            }
            renderItem={({ item }) => (
              <Pressable style={e.item} accessibilityRole="button" onPress={() => navigation.navigate("Ponto", { ponto: item })}>
                <Text style={e.itemNome}>{item.nome}</Text>
                <Text style={e.itemInfo}>{formatarDistancia(item.distanciaMetros)} · {item.endereco}</Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </View>
  );
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  mapa: { height: "45%" },
  creditos: { fontSize: 11, color: cor.textoSuave, textAlign: "right", paddingHorizontal: 8 },
  painel: { flex: 1, padding: 16, gap: 10 },
  aviso: { backgroundColor: cor.alertaFundo, color: cor.alerta, padding: 10, borderRadius: raio },
  filtro: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  limpar: { minHeight: toqueMinimo, justifyContent: "center", paddingHorizontal: 8 },
  texto: { fontSize: 15, color: cor.texto },
  raios: { flexDirection: "row", gap: 6 },
  raio: {
    flex: 1, minHeight: toqueMinimo, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: cor.primaria, borderRadius: raio,
  },
  raioAtivo: { backgroundColor: cor.primaria },
  raioTexto: { color: cor.primaria, fontWeight: "600" },
  item: { minHeight: toqueMinimo, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: cor.borda },
  itemNome: { fontSize: 16, fontWeight: "600", color: cor.texto },
  itemInfo: { fontSize: 14, color: cor.textoSuave },
});
