import { useCallback, useEffect, useState } from "react";
import { foiCancelada } from "./api";

/** Executa uma consulta à API, cancelando a anterior quando as dependências mudam. */
export function useConsulta<T>(buscar: (sinal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [dados, setDados] = useState<T>();
  const [erro, setErro] = useState<string>();
  const [carregando, setCarregando] = useState(true);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controle = new AbortController();
    setCarregando(true);
    setErro(undefined);
    buscar(controle.signal)
      .then((d) => { setDados(d); setCarregando(false); })
      .catch((e) => {
        if (foiCancelada(e)) return;
        setErro("Não foi possível falar com o servidor. Verifique sua conexão.");
        setCarregando(false);
      });
    return () => controle.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tentativa]);

  const tentar = useCallback(() => setTentativa((t) => t + 1), []);
  return { dados, erro, carregando, tentar };
}
