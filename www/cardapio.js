// Cardápio base do nutri: alimentos comuns da Tabela TACO (pelo número na tabela), com grupo, porção típica,
// unidade caseira e as refeições onde costumam entrar. É de onde saem as sugestões de alimentos novos e as
// listas de substituição do plano alimentar.

// [número TACO, grupo, porção típica em g, unidade { nome, plural, g } ou null, refeições]
const C = (t, grupo, g, unidade, refs) => ({ t, grupo, g, unidade, refs: refs.split(" ") });
const un = (nome, plural, g) => ({ nome, plural, g });
const PRINCIPAIS = "almoco janta", LANCHES = "cafe pos_treino ceia";

export const GRUPOS_ALIMENTO = {
  proteina: "Proteína", proteina_leve: "Proteína leve", carbo: "Carboidrato", leguminosa: "Leguminosa",
  vegetal: "Legumes e verduras", pao: "Pães e cereais", fruta: "Fruta", gordura: "Gordura boa",
};

export const CARDAPIO = [
  // proteínas de almoço e janta
  C(410, "proteina", 120, null, PRINCIPAIS),             // frango, peito, sem pele, grelhado
  C(408, "proteina", 120, null, PRINCIPAIS),             // frango, peito, sem pele, cozido
  C(398, "proteina", 120, null, PRINCIPAIS),             // frango, coxa, sem pele, cozida
  C(377, "proteina", 120, null, PRINCIPAIS),             // patinho grelhado
  C(371, "proteina", 120, null, PRINCIPAIS),             // músculo cozido
  C(326, "proteina", 120, null, PRINCIPAIS),             // acém moído cozido
  C(346, "proteina", 120, null, PRINCIPAIS),             // contra-filé sem gordura grelhado
  C(358, "proteina", 120, null, PRINCIPAIS),             // filé mignon grelhado
  C(432, "proteina", 120, null, PRINCIPAIS),             // lombo de porco assado
  C(301, "proteina", 140, null, PRINCIPAIS),             // merluza assada
  C(318, "proteina", 100, null, PRINCIPAIS),             // sardinha assada
  C(317, "proteina", 120, null, PRINCIPAIS),             // salmão grelhado
  // proteínas de lanche (também servem no almoço e na janta)
  C(488, "proteina_leve", 100, un("ovo cozido", "ovos cozidos", 50), "cafe pos_treino ceia almoco janta"),
  C(490, "proteina_leve", 100, un("ovo frito", "ovos fritos", 50), "cafe almoco janta"),
  C(486, "proteina_leve", 99, un("clara cozida", "claras cozidas", 33), "cafe pos_treino ceia"),
  C(448, "proteina_leve", 170, un("pote de iogurte", "potes de iogurte", 170), LANCHES),
  C(449, "proteina_leve", 170, un("pote de iogurte desnatado", "potes de iogurte desnatado", 170), LANCHES),
  C(461, "proteina_leve", 60, un("fatia de minas frescal", "fatias de minas frescal", 30), "cafe ceia"),
  C(469, "proteina_leve", 60, null, "cafe ceia"),           // ricota
  C(463, "proteina_leve", 40, un("fatia de mozarela", "fatias de mozarela", 20), "cafe"),
  C(277, "proteina_leve", 60, null, "pos_treino almoco janta"), // atum em óleo
  C(439, "proteina_leve", 45, un("fatia de presunto", "fatias de presunto", 15), "cafe"),
  // carboidratos de almoço e janta
  C(3, "carbo", 150, null, PRINCIPAIS + " pos_treino"),   // arroz branco cozido
  C(1, "carbo", 150, null, PRINCIPAIS + " pos_treino"),   // arroz integral cozido
  C(91, "carbo", 200, null, PRINCIPAIS),                  // batata inglesa cozida
  C(88, "carbo", 150, null, PRINCIPAIS + " pos_treino"),  // batata-doce cozida
  C(129, "carbo", 120, null, PRINCIPAIS),                 // mandioca cozida
  C(533, "carbo", 150, null, "cafe almoco janta"),        // cuscuz de milho
  // leguminosas
  C(561, "leguminosa", 100, null, PRINCIPAIS),            // feijão carioca cozido
  C(567, "leguminosa", 100, null, PRINCIPAIS),            // feijão preto cozido
  C(577, "leguminosa", 100, null, PRINCIPAIS),            // lentilha cozida
  // legumes e verduras (quase não pesam nas calorias)
  C(100, "vegetal", 80, null, PRINCIPAIS),                // brócolis cozido
  C(109, "vegetal", 60, null, PRINCIPAIS),                // cenoura cozida
  C(157, "vegetal", 80, null, PRINCIPAIS),                // tomate
  C(78, "vegetal", 40, null, PRINCIPAIS),                 // alface crespa
  C(70, "vegetal", 80, null, PRINCIPAIS),                 // abobrinha cozida
  C(118, "vegetal", 80, null, PRINCIPAIS),                // couve-flor cozida
  C(64, "vegetal", 100, null, PRINCIPAIS),                // abóbora cabotiá cozida
  // pães e cereais
  C(53, "pao", 50, un("pão francês", "pães franceses", 50), "cafe pos_treino ceia"),
  C(52, "pao", 50, un("fatia de pão integral", "fatias de pão integral", 25), "cafe pos_treino ceia"),
  C(7, "pao", 30, un("colher de sopa de aveia", "colheres de sopa de aveia", 15), "cafe pos_treino ceia"),
  // frutas
  C(182, "fruta", 80, un("banana prata", "bananas prata", 80), "cafe pos_treino ceia"),
  C(222, "fruta", 130, un("maçã", "maçãs", 130), "cafe pos_treino ceia"),
  C(226, "fruta", 150, un("meio mamão papaia", "mamões papaia (metades)", 150), "cafe ceia"),
  C(239, "fruta", 150, null, "cafe ceia pos_treino"),     // morango
  C(214, "fruta", 130, un("laranja", "laranjas", 130), "cafe pos_treino ceia"),
  C(231, "fruta", 150, null, "cafe pos_treino ceia"),     // manga
  // gorduras boas
  C(260, "gordura", 8, un("colher de sopa de azeite", "colheres de sopa de azeite", 8), PRINCIPAIS),
  C(557, "gordura", 20, null, "cafe ceia"),               // amendoim
  C(589, "gordura", 12, un("castanha-do-pará", "castanhas-do-pará", 4), "cafe ceia"),
  C(163, "gordura", 100, null, "cafe ceia"),              // abacate
];

// Montagem de cada refeição: grupos na ordem em que entram no prato. "?" marca grupo opcional.
export const MOLDES = {
  cafe: [["pao", "proteina_leve", "fruta?"], ["pao", "proteina_leve"], ["proteina_leve", "fruta", "gordura?"]],
  almoco: [["proteina", "carbo", "leguminosa", "vegetal"], ["proteina", "carbo", "vegetal", "vegetal"]],
  pos_treino: [["fruta", "proteina_leve"], ["pao", "proteina_leve"], ["carbo", "proteina_leve"]],
  janta: [["proteina", "carbo", "leguminosa", "vegetal"], ["proteina", "carbo", "vegetal"], ["proteina_leve", "pao", "vegetal?"]],
  ceia: [["proteina_leve", "fruta?"], ["proteina_leve", "gordura?"]],
};
