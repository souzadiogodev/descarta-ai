import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Abas as TAbas, Rotas } from "./src/navegacao";
import { cor } from "./src/tema";
import Inicio from "./src/telas/Inicio";
import Guia from "./src/telas/Guia";
import Material from "./src/telas/Material";
import Mapa from "./src/telas/Mapa";
import Ponto from "./src/telas/Ponto";
import Foto from "./src/telas/Foto";
import Dicas from "./src/telas/Dicas";

const Pilha = createNativeStackNavigator<Rotas>();
const Tab = createBottomTabNavigator<TAbas>();

const cabecalho = {
  headerStyle: { backgroundColor: cor.cabecalho },
  headerTintColor: "#fff",
  headerTitleStyle: { fontWeight: "700" as const },
};

function Abas() {
  return (
    <Tab.Navigator
      screenOptions={{
        ...cabecalho,
        tabBarActiveTintColor: cor.primaria,
        tabBarInactiveTintColor: cor.textoSuave,
        tabBarLabelStyle: { fontSize: 14, fontWeight: "600" },
        tabBarIconStyle: { display: "none" },
      }}
    >
      <Tab.Screen name="Inicio" component={Inicio} options={{ title: "Descarta Aí", tabBarLabel: "Início" }} />
      <Tab.Screen name="Guia" component={Guia} options={{ title: "Guia de descarte", tabBarLabel: "Guia" }} />
      <Tab.Screen name="Mapa" component={Mapa} options={{ title: "Pontos de coleta", tabBarLabel: "Mapa" }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Pilha.Navigator screenOptions={cabecalho}>
          <Pilha.Screen name="Abas" component={Abas} options={{ headerShown: false }} />
          <Pilha.Screen name="Material" component={Material} options={({ route }) => ({ title: route.params.nome })} />
          <Pilha.Screen name="Ponto" component={Ponto} options={{ title: "Ponto de coleta" }} />
          <Pilha.Screen name="Foto" component={Foto} options={{ title: "Identificar por foto" }} />
          <Pilha.Screen name="Dicas" component={Dicas} options={{ title: "Dicas de descarte" }} />
        </Pilha.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
