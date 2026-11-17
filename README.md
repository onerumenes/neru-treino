# Neru Calorias

Diário de calorias, proteína e treino. Funciona no navegador do celular e como app Android que se
atualiza sozinho. Os dados ficam só no aparelho.

- **Diário:** 5 refeições, registro manual, favoritos, repetir o de ontem, metas pelo perfil.
- **IA (OpenAI):** registra, corrige e apaga por texto, foto do prato ou do rótulo, e áudio.
- **Treino:** plano editável (começa com um modelo de 5 dias), registro de séries e sugestão de carga.
- **Progresso:** peso, últimos 7 dias, evolução das cargas, sono, exportação em texto.
- **Suplementos:** lista de marcar no fim do diário de cada dia.

## Pastas

| Caminho | O que é |
|---|---|
| `www/` | O app em si (HTML, CSS, JS). É aqui que se mexe no dia a dia. |
| `tools/build.py` | Carimba a versão e gera `dist/app` (vai no APK) e `dist/site` (vai para o GitHub Pages, com `atualizacoes/latest.json` e o zip). |
| `tools/preparar_android.py` | Ajusta o projeto Android gerado pelo Capacitor: versão, microfone, ícones, assinatura. |
| `android-recursos/` | Ícones e tela de abertura do APK. |
| `neru.config.json` | Número do APK (`apk`) e o APK mínimo para o código atual (`apk_min`). |
| `.github/workflows/` | `publicar.yml` publica a cada envio; `apk.yml` compila o APK. |

## Primeira vez (uns 15 minutos)

1. **Cria o repositório.** No GitHub, cria um repositório **público** chamado `neru-calorias` e envia
   todo o conteúdo desta pasta para a branch `main`. A pasta `chave-android` **não** vai junto.
2. **Liga o GitHub Pages.** Settings > Pages > Source: **GitHub Actions**.
3. **Cadastra a chave do APK.** Settings > Secrets and variables > Actions. Cria os 4 segredos que estão
   no `LEIA-ME.txt` da pasta `chave-android`.
4. **Publica.** Na aba Actions, roda **Publicar atualização** e depois **Gerar APK** (botão "Run workflow").
   O APK leva uns 5 minutos.
5. **Instala no celular.** Abre no Chrome do celular:
   `https://github.com/SEU_USUARIO/neru-calorias/releases/latest/download/neru-calorias.apk`
   e instala (o Android pede para permitir instalar apps desta fonte).
6. **Cola a chave da OpenAI** em Ajustes > IA da OpenAI e toca em "Salvar e testar".

A versão web fica em `https://SEU_USUARIO.github.io/neru-calorias/` e também pode ser instalada pelo
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
favoritos, suplementos e metas (sem a chave da OpenAI). Restaurar backup troca tudo pelo do arquivo.
No app Android, o backup abre a tela de compartilhar do celular (Drive, WhatsApp, Arquivos).

## Regras que o app usa

- **Metas:** gasto pela fórmula de Mifflin-St Jeor vezes o fator de atividade, menos (ou mais) o ritmo
  escolhido a 7.700 kcal por kg. Proteína de 2,0 g/kg para perder, 1,6 para manter, 1,8 para ganhar.
  Piso de 1.500 kcal (homem) ou 1.200 (mulher).
- **Carga sugerida (progressão dupla):** fechou o máximo da faixa em todas as séries, sobe um passo
  (2,5 kg na barra, 2 kg nos halteres, 5 a 10 kg em máquinas); ficou abaixo do mínimo, desce um passo;
  no meio, mantém a carga e busca mais repetições.

Fonte: Bricolage Grotesque, licença SIL OFL 1.1.
