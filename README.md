# Neru Calorias

Diário de calorias, proteína e treino. Funciona no navegador do celular e como app Android que se
atualiza sozinho. Os dados ficam só no aparelho.

- **Diário:** 5 refeições, registro manual com busca em 591 alimentos da Tabela TACO e conta automática
  pelas gramas, favoritos, repetir o de ontem, metas pelo perfil.
- **Nutri:** "O que eu como agora?" (monta o resto do dia com o que você costuma comer, sem passar da
  meta), consulta inicial, plano alimentar flexível ou fechado com lista de substituição, gasto real pela
  evolução do peso, check-in semanal que ajusta a meta e retorno mensal.
- **Personal:** avaliação (nível, dias, tempo, lesões, prioridades), programa gerado com volume por
  músculo, RIR por série, cronômetro de descanso, recordes, exercícios parados, blocos de 5 semanas com
  semana de recuperação, e análise das fotos do físico.
- **Equipe:** regras que juntam os dois (força caindo em déficit, ganho rápido no bulking, dia de perna,
  proteína baixa), relatório semanal e lembretes no celular.
- **Corpo:** peso com tendência, medidas com percentual de gordura (fórmula da Marinha americana), fotos
  padronizadas com comparação antes e depois. As fotos ficam só no aparelho.
- **IA híbrida:** um modelo Gemma rodando no próprio celular (LiteRT-LM) e/ou a OpenAI. A IA só explica e
  conversa; as contas são do app.
- **Suplementos e sono**, exportação em texto.

## Como o app pensa

As contas (porções, metas, gasto real, volume de treino, progressão) são regras em JavaScript, testáveis
e iguais sempre. A IA recebe os números prontos e só escreve a explicação, com a instrução de não
inventar valores. Por isso o modelo pequeno do celular dá conta.

| Arquivo | O que faz |
|---|---|
| `www/nutri.js` | Perfil das refeições, "O que eu como agora?", gasto (fórmula → estimado pelos treinos → medido), ritmo automático, proteína pela massa magra, ciclo, dica de proteína, check-in |
| `www/cardapio.js` | Alimentos da TACO que o nutri sugere, por grupo, com porção e unidade caseira |
| `www/plano-alimentar.js` | Plano alimentar e substituições com as mesmas calorias |
| `www/personal.js` | Gerador de programa, 1RM estimado com RIR, recordes, estagnação, série principal + recuo (foco em força), descanso e semana leve |
| `www/equipe.js` | Regras entre nutri e personal, metas temporárias e relatório semanal |
| `www/corpo.js` | Medidas, gordura (fita, dobras de Jackson-Pollock e calibração por exame), dores, saúde e fotos (no IndexedDB, fora do backup) |
| `www/ia.js`, `www/ia-local.js` | Rotas da IA: celular ou OpenAI conforme a tarefa e os Ajustes |
| `www/equipe-ia.js` | Os textos que a IA escreve sobre os números (sugestão, check-in, retorno, fotos) |
| `www/lembretes.js` | Notificações de refeição, pesagem, check-in e treino |
| `www/tela-perfil.js` | Aba Perfil: ficha do corpo com o avatar, medidas com a fita sobre o corpo e a linha do tempo |
| `www/tela-dados.js` | Dados pessoais (o lápis do Perfil, e o primeiro uso) e Objetivo e ritmo |
| `www/tela-fotos.js` | Fotos do físico: a mesma pose lado a lado, a análise pela IA e as próximas fotos |
| `www/tela-avaliacao.js` | Avaliação corporal: dia de avaliação, dobras cutâneas, simetria, mapa de dores e saúde |
| `www/musculos.js` | Carga por músculo: séries efetivas (perto da falha vale mais, composto conta meia série nos que ajudam), recuperação, força, sinais da semana leve e sugestões de volume |
| `www/tela-treino-corpo.js` | Treino no corpo: o avatar pintado por estímulo, recuperação ou força |
| `www/avatar.js` | Avatar anatômico: cada músculo escala pela medida da fita, com a camada de gordura por região |
| `plugins/ia-local/` | Plugin Android (Java) que roda o modelo `.litertlm` com o LiteRT-LM |

## Pastas

| Caminho | O que é |
|---|---|
| `www/` | O app em si (HTML, CSS, JS). É aqui que se mexe no dia a dia. |
| `plugins/ia-local/` | Plugin nativo da IA no celular (entra no APK). |
| `tools/build.py` | Carimba a versão e gera `dist/app` (vai no APK) e `dist/site` (vai para o GitHub Pages, com `atualizacoes/latest.json` e o zip). |
| `tools/taco.py` | Gera `www/alimentos.js` a partir da planilha oficial da TACO. |
| `tools/corpo_anatomico.mjs` | Gera `www/corpo-anatomico.json` (o desenho do corpo) a partir do react-native-body-highlighter. |
| `tests/` | Testes das contas (`npm test`, precisa de Node 20+). |
| `tools/preparar_android.py` | Ajusta o projeto Android gerado pelo Capacitor: versão, microfone, ícones, assinatura. |
| `android-recursos/` | Ícones, ícone das notificações e tela de abertura do APK. |
| `neru.config.json` | Número do APK (`apk`) e o APK mínimo para o código atual (`apk_min`). |
| `.github/workflows/` | `publicar.yml` publica a cada envio; `apk.yml` compila o APK. |

## IA no celular

Precisa do APK 3 ou mais novo. Em Ajustes > IA no celular, escolhe o modelo e toca em Baixar (pelo
Wi-Fi): Gemma 4 E2B (2,6 GB, mais rápido) ou E4B (3,7 GB, entende melhor), da `litert-community` no
Hugging Face. Se o download pedir login, baixa o `.litertlm` pelo navegador e usa "Escolher arquivo".
Depois, "Carregar e testar" e liga "Usar a IA do celular".

Rotas: com a IA do celular ligada, o dia a dia (chat, explicações, relatório) roda no celular. Foto de
prato e retorno mensal vão para a OpenAI se estiverem marcados em Ajustes (vêm marcados). As fotos do
físico só são vistas pela IA do celular, a não ser que você ligue o contrário. O áudio continua na
transcrição da OpenAI. Se a IA do celular falhar, a OpenAI assume, quando há chave.

## Primeira vez (uns 15 minutos)

1. **Cria o repositório.** No GitHub, cria um repositório **público** chamado `neru-treino` e envia
   todo o conteúdo desta pasta para a branch `main`. A pasta `chave-android` **não** vai junto.
2. **Liga o GitHub Pages.** Settings > Pages > Source: **GitHub Actions**.
3. **Cadastra a chave do APK.** Settings > Secrets and variables > Actions. Cria os 4 segredos que estão
   no `LEIA-ME.txt` da pasta `chave-android`.
4. **Publica.** Na aba Actions, roda **Publicar atualização** e depois **Gerar APK** (botão "Run workflow").
   O APK leva uns 5 minutos.
5. **Instala no celular.** Abre no Chrome do celular:
   `https://github.com/SEU_USUARIO/neru-treino/releases/latest/download/neru-calorias.apk`
   e instala (o Android pede para permitir instalar apps desta fonte).
6. **Cola a chave da OpenAI** em Ajustes > IA da OpenAI e toca em "Salvar e testar".

A versão web fica em `https://SEU_USUARIO.github.io/neru-treino/` e também pode ser instalada pelo
Chrome ("Adicionar à tela inicial"), mas os dados do app Android e os do navegador são separados.

## Dia a dia: mudar o app

Edita os arquivos de `www/` e envia para a `main`. O workflow **Publicar atualização** gera a versão nova
sozinho. Na próxima vez que o app abrir com internet, ele baixa o pacote em segundo plano e mostra
"Atualização pronta". Toca no aviso para aplicar na hora, ou deixa que entra na abertura seguinte.
A mensagem do commit aparece no aviso.

Se a versão nova não abrir em 10 segundos, o app volta sozinho para a anterior e não tenta de novo
aquela versão. O diário nunca é afetado pelas atualizações.

Para testar antes de enviar, roda um servidor local e abre no navegador:

```
cd www
python -m http.server 8000
```

As contas têm testes: `npm test`.

## Quando precisa de APK novo

Só quando muda algo nativo: um plugin novo do Capacitor, permissões, ícone, nome do app.

1. Em `neru.config.json`, aumenta `apk` em 1. Se adicionaste plugin nativo, iguala `apk_min` a ele.
2. Envia. O workflow **Gerar APK** roda sozinho e publica o Release.
3. Quem tem o APK antigo e `apk_min` subiu vê "Esta atualização precisa do APK novo. Toca para baixar".
   O APK novo instala por cima, sem perder dados, desde que assinado com a mesma chave.

## Chave do APK

Gerada com `keytool` e entregue na pasta `chave-android` (fora deste repositório). **Não perde**: sem
ela o Android não aceita instalar um APK novo por cima do app, e seria preciso desinstalar.

## IA

A chave da OpenAI fica só no aparelho, não entra no backup nem no código. Modelos padrão, editáveis
em Ajustes: `gpt-6-luna` (conversa e fotos) e `gpt-transcribe` (áudio). Vale pôr um limite de gasto
mensal na conta da OpenAI.

## Dados

Tudo fica no aparelho (IndexedDB). Ajustes > Baixar backup gera um `.json` com diário, treinos,
favoritos, suplementos, medidas, consulta, plano e metas (sem a chave da OpenAI). As fotos do físico e o
modelo de IA não entram: ficam só no aparelho. Restaurar backup troca tudo pelo do arquivo.
No app Android, o backup abre a tela de compartilhar do celular (Drive, WhatsApp, Arquivos).

O app não substitui médico, nutricionista nem educador físico. Quem marca algum alerta de saúde na
consulta (doença renal, diabetes, gestação, histórico de transtorno alimentar e outros) recebe ajustes
menores e o lembrete de ter acompanhamento profissional.

## Regras que o app usa

- **Metas:** gasto pela fórmula de Mifflin-St Jeor vezes o fator de atividade, menos (ou mais) o ritmo
  escolhido a 7.700 kcal por kg. Proteína de 2,0 g/kg para perder, 1,6 para manter, 1,8 para ganhar.
  Piso de 1.500 kcal (homem) ou 1.200 (mulher).
- **Carga sugerida (progressão dupla):** fechou o máximo da faixa em todas as séries, sobe um passo
  (2,5 kg na barra, 2 kg nos halteres, 5 a 10 kg em máquinas); ficou abaixo do mínimo, desce um passo;
  no meio, mantém a carga e busca mais repetições.

## Tabela de alimentos

`www/alimentos.js` traz calorias, proteína, carboidrato e gordura por 100 g dos alimentos da **Tabela
Brasileira de Composição de Alimentos (TACO), 4ª edição revisada e ampliada, NEPA/UNICAMP, 2011**, que
permite reprodução com citação da fonte. Ficam de fora os 6 itens sem valor de calorias na tabela
(entre eles leite de vaca integral e desnatado UHT, que estavam "em análise").

Para regerar: baixa `Taco_4a_edicao_2011.xls` (site do NEPA ou a pasta `references` do repositório
`isaquetdiniz/taco-api`), `pip install xlrd` e `python3 tools/taco.py caminho/Taco_4a_edicao_2011.xls`.

No formulário, cada item guarda as gramas (`g`) e a base por 100 g (`b`). Mudar as gramas recalcula os
nutrientes. Valores digitados à mão (de um rótulo, por exemplo) viram a base assim que as gramas são
preenchidas.

## Desenho do corpo

`www/corpo-anatomico.json` vem do [react-native-body-highlighter](https://github.com/HichamELBSI/react-native-body-highlighter)
(licença MIT, ELABBASSI Hicham): corpo masculino e feminino, de frente e de costas, com cada músculo separado.
O texto da licença aparece em Ajustes > Créditos. Para regerar:

```
git clone --depth 1 https://github.com/HichamELBSI/react-native-body-highlighter /tmp/rnbh
npm i --no-save svgpath svg-path-bbox
node tools/corpo_anatomico.mjs /tmp/rnbh www/corpo-anatomico.json
```

As medidas que o desenho original representa e o exagero visual ficam em `REF` e `EXAGERO`, no começo de `www/avatar.js`.

Fonte: Bricolage Grotesque, licença SIL OFL 1.1.
