-- Seed: 50 моделей × 5 брендов для Legit Check MVP.
--
-- Источники auth_markers + red_flags (для аудита):
--   - LegitGrails (legitgrails.com), Legit Check By Ch (legitcheck.app)
--   - Common Cultured, Don Threads, Street Garms (Stone Island)
--   - StockX/GOAT public auth guides
--   - r/Repsneakers, r/RepLadies (community knowledge)
--
-- Все маркеры — на русском (целевой пользователь — Беларусь/РФ).
-- AI vision prompt будет читать массивы как чек-листы.

-- ============================================================================
-- 1. БРЕНДЫ
-- ============================================================================
INSERT INTO legit_check_brands (slug, name, category, reliability_score, common_red_flags, notes) VALUES
  ('nike', 'Nike', 'sneakers', 82, ARRAY[
    'Логотип Swoosh неровный, слишком толстый или с пропусками',
    'Шов вокруг Swoosh сделан клеем, а не нитками',
    'Бирка с серийником: шрифт жирнее обычного, текст наклонён',
    'Коробка: оранжевая часть слишком яркая или матовая (вместо глянцевой)',
    'Стикер на коробке: SKU не сходится с реальной моделью или дата выпуска нелогична'
  ], 'Nike — самый массовый бренд реплик. Smoking gun обычно в бирке с серийником.'),

  ('adidas', 'Adidas', 'sneakers', 80, ARRAY[
    'Три полоски: ширина непостоянная, расстояние между ними неровное',
    'Бирка: шрифт adidas с засечками вместо санс-серифа',
    'Стелька: BOOST-пена выглядит слишком гладкой (на оригинале — пористая)',
    'Стикер на коробке: barcode не сканируется через приложение adidas Confirmed',
    'Поддельные Yeezy: подошва BOOST неравномерной плотности'
  ], 'Adidas Originals (Samba, Stan Smith, Yeezy) — частые реплики. Фокус на стельку и BOOST-пену.'),

  ('stone-island', 'Stone Island', 'clothing', 65, ARRAY[
    'Бэдж компаса: нити блестят (на оригинале — матовые)',
    'Бэдж сзади: компас выглядит слишком крупным или утолщённым',
    'Шрифт STONE ISLAND: засечки на A прямые (на оригинале — изогнутые)',
    'Петли крепления бэджа: неровные или растрёпанные',
    'Жёлто-зелёный цвет нитей: слишком яркий неоновый (на оригинале — приглушённый)',
    'Care label: шрифт не совпадает, нет даты производства или коды артикулов нелогичны'
  ], 'Главный артефакт — бэдж компаса. AI должен оценивать в первую очередь его.'),

  ('stussy', 'Stüssy', 'clothing', 75, ARRAY[
    'Логотип Stüssy: разная толщина букв (на оригинале — одинаковая font-weight)',
    'Буква "ü": точки квадратные (на оригинале — ромбовидные)',
    'Буква "t" в Stüssy: не загибается внизу (на оригинале — загибается)',
    'Шейная бирка: материал бирки тоньше и блестящий',
    'Принт на футболке: размыт по краям или с потёками',
    'Кулиска худи: материал шнура отличается от оригинала'
  ], 'Stüssy — фокус на типографику логотипа и шейную бирку.'),

  ('carhartt-wip', 'Carhartt WIP', 'clothing', 78, ARRAY[
    'Квадратный лейбл (Square Label): шрифт слишком жирный или мелкий',
    'Внутренняя care-бирка: артикул не начинается с I0 или K0 (формат Carhartt WIP)',
    'Молнии: бренд молнии не YKK (Carhartt WIP использует YKK)',
    'Заклёпки/пуговицы: без гравировки Carhartt или с неправильным шрифтом',
    'Подкладка: материал тоньше, простёжка ромбом неаккуратная',
    'Размерная бирка: содержит "Carhartt" без "WIP" (это нелицензированная подделка)'
  ], 'WIP (Work In Progress) — европейская линия Carhartt, отличается от US-версии. Это частая путаница (не подделка).');

-- ============================================================================
-- 2. МОДЕЛИ — NIKE (10)
-- ============================================================================
INSERT INTO legit_check_models (brand_id, slug, name, category, sku_pattern, auth_markers, red_flags, aliases, notes) VALUES
  ((SELECT id FROM legit_check_brands WHERE slug='nike'), 'air-jordan-1-high-og', 'Air Jordan 1 High OG', 'sneakers',
    '^[A-Z]{2}[0-9]{4}-[0-9]{3}$', -- DZ5485-612, 555088-XXX
    ARRAY[
      'Стиль-код в правом верхнем углу размерной бирки: тонкий шрифт, формат "XX0000-000"',
      'Текст "AIR" на пятке: чёткий, центрирован вертикально, ровные засечки',
      'Swoosh: ровные стежки 7-9 на см, без следов клея',
      'Jumpman на язычке: симметричный, мяч-баскетбол ровно круглый',
      'Insole stamp: "AIR JORDAN" чёткий, без размытия',
      'Размерная бирка: BR/EUR/UK/US — тонкий шрифт, без наклона'
    ],
    ARRAY[
      'Стиль-код на бирке: жирный шрифт, буквы выглядят квадратнее',
      'Текст "AIR" на пятке: смещён, неровные засечки',
      'Swoosh: неровные стежки или следы клея',
      'Jumpman на язычке: голова непропорциональна туловищу',
      'Шрифт на бирке: другой font (не Helvetica/Univers)',
      'Подошва: воздушная капсула AIR выглядит мутной'
    ],
    ARRAY['Jordan 1 High', 'AJ1 High', 'Jordan 1', 'аир джордан 1'],
    'AJ1 High — самая копируемая модель Nike. Проверка по бирке + Jumpman даёт 80% точности.'),

  ((SELECT id FROM legit_check_brands WHERE slug='nike'), 'air-jordan-1-mid', 'Air Jordan 1 Mid', 'sneakers',
    '^[0-9]{6}-[0-9]{3}$',
    ARRAY[
      'Стиль-код: формат "554724-XXX" (6 цифр + 3 цифры)',
      'Текст "AIR" на пятке: чёткий, без размытия',
      'Кожа: натуральная, с мелкими порами',
      'Swoosh пришит, не приклеен'
    ],
    ARRAY[
      'Стиль-код: 7-значный код (это GS-версия или подделка)',
      'Кожа: гладкая пластиковая или слишком блестящая',
      'Швы: видны следы клея',
      'Jumpman: непропорциональный'
    ],
    ARRAY['Jordan 1 Mid', 'AJ1 Mid', 'джордан 1 мид'],
    'Mid — частая модель для подделок из-за более низкой цены.'),

  ((SELECT id FROM legit_check_brands WHERE slug='nike'), 'air-jordan-1-low', 'Air Jordan 1 Low', 'sneakers',
    '^[0-9]{6}-[0-9]{3}$',
    ARRAY[
      'Стиль-код: формат "553558-XXX"',
      'Текст на размерной бирке: тонкий, ровно расположен',
      'Swoosh: пришит, ровные стежки',
      'Подошва: чёткое разделение цветов'
    ],
    ARRAY[
      'Стиль-код: жирный шрифт на бирке',
      'Размерная бирка: "BR" и другие надписи слишком толстые',
      'Подошва: пятна на стыке цветов'
    ],
    ARRAY['Jordan 1 Low', 'AJ1 Low'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='nike'), 'dunk-low', 'Nike Dunk Low', 'sneakers',
    '^[A-Z]{2}[0-9]{4}-[0-9]{3}$', -- DD1391-100
    ARRAY[
      'Swoosh: широкий, толстый, с явной кривизной',
      'Стельная стелька: чёткие линии стежков, без следов клея',
      'Бэк-каунтер (задник): шов "NIKE" ровный по горизонтали',
      'Подошва: соотношение белого/коричневого/чёрного точное',
      'Box label: SKU и колорвей-код совпадают с реальной моделью'
    ],
    ARRAY[
      'Swoosh: уже, тоньше, менее изогнутый',
      'Задник: текст NIKE сдвинут или несимметричен',
      'Подошва: коричневая часть матовая (на оригинале — глянцевая)',
      'Toe-box: плоский кончик (на оригинале — закруглённый)'
    ],
    ARRAY['Dunk Low', 'найк данк', 'данк лоу'],
    'Dunk Low — Swoosh-форма самый надёжный признак. Толщина и изгиб.'),

  ((SELECT id FROM legit_check_brands WHERE slug='nike'), 'dunk-high', 'Nike Dunk High', 'sneakers',
    '^[A-Z]{2}[0-9]{4}-[0-9]{3}$',
    ARRAY[
      'Swoosh: широкий и толстый, как у Low',
      'Высокий задник: ровные швы, текст NIKE центрирован',
      'Bootie collar: мягкий, не топорщится'
    ],
    ARRAY[
      'Swoosh: тонкий или с пропусками',
      'Bootie: жёсткий, торчит',
      'Швы по верху: неровные'
    ],
    ARRAY['Dunk High', 'данк хай'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='nike'), 'air-force-1-low', 'Air Force 1 ''07 Low', 'sneakers',
    '^[A-Z]{2}[0-9]{4}-[0-9]{3}$', -- CW2288-111
    ARRAY[
      'Стиль-код: "CW2288-XXX" для классического Triple White',
      'Swoosh: толстый, с явной кривизной',
      'Heel tab: золотое тиснение "AF-1 ''82" чёткое',
      'Подошва: воздушная капсула видна сбоку, прозрачная',
      'Шнурки: круглые, плотные, не плоские'
    ],
    ARRAY[
      'Heel tab: тиснение размыто или сдвинуто',
      'Подошва: воздушная капсула мутная или не видна',
      'Шнурки: плоские (на оригинале — круглые)',
      'Insole: текст AF-1 размыт'
    ],
    ARRAY['AF1', 'AF-1', 'Air Force 1', 'эир форс'],
    'AF1 — массовая модель. Heel tab и воздушная капсула — главные маркеры.'),

  ((SELECT id FROM legit_check_brands WHERE slug='nike'), 'air-max-90', 'Air Max 90', 'sneakers',
    '^[A-Z]{2}[0-9]{4}-[0-9]{3}$',
    ARRAY[
      'Воздушная капсула на пятке: чётко видна, без пузырей в Air',
      'Замша на боковых панелях: натуральная, не пластиковая',
      'Швы вокруг Air Max окна: ровные',
      'Логотип Nike на язычке: вышит, не нашит'
    ],
    ARRAY[
      'Air-окно: помутневшее или с пузырями воздуха',
      'Замша: блестящая или слишком гладкая',
      'Логотип на язычке: нашит, а не вышит'
    ],
    ARRAY['AM90', 'Air Max 90'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='nike'), 'air-max-95', 'Air Max 95', 'sneakers',
    '^[A-Z]{2}[0-9]{4}-[0-9]{3}$',
    ARRAY[
      'Многослойная градиентная замша: переходы плавные',
      'Air Max окна: 2 капсулы (носок + пятка), прозрачные',
      'Шнурки: плоские, как на оригинале',
      'Стиль-код на бирке: тонкий шрифт'
    ],
    ARRAY[
      'Градиент замши: резкие переходы между слоями',
      'Air-окна: помутневшие',
      'Стиль-код: жирный шрифт'
    ],
    ARRAY['AM95'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='nike'), 'air-max-97', 'Air Max 97', 'sneakers',
    '^[A-Z]{2}[0-9]{4}-[0-9]{3}$',
    ARRAY[
      'Полная воздушная капсула вдоль всей подошвы: ровная, без пузырей',
      'Светоотражающие 3M-полосы: ярко вспыхивают под фонариком',
      'Швы по бокам: ровные, без следов клея'
    ],
    ARRAY[
      'Air-капсула: пузыри или мутность',
      '3M-полосы: тусклые или не вспыхивают',
      'Швы: следы клея'
    ],
    ARRAY['AM97'],
    'Тест фонариком — самый быстрый для AM97 (светоотражающие полосы).'),

  ((SELECT id FROM legit_check_brands WHERE slug='nike'), 'cortez', 'Nike Cortez', 'sneakers',
    '^[A-Z]{2}[0-9]{4}-[0-9]{3}$',
    ARRAY[
      'Подошва: ребристая EVA, не плоская',
      'Swoosh: пришит, длинный',
      'Heel tab: вышитое "Cortez" или Nike script'
    ],
    ARRAY[
      'Подошва: гладкая или с другим рисунком',
      'Swoosh: коротковат',
      'Heel tab: принт вместо вышивки'
    ],
    ARRAY['Cortez', 'кортез'],
    NULL);

-- ============================================================================
-- 3. МОДЕЛИ — ADIDAS (10)
-- ============================================================================
INSERT INTO legit_check_models (brand_id, slug, name, category, sku_pattern, auth_markers, red_flags, aliases, notes) VALUES
  ((SELECT id FROM legit_check_brands WHERE slug='adidas'), 'yeezy-boost-350-v2', 'Yeezy Boost 350 V2', 'sneakers',
    '^[A-Z]{1,3}[0-9]{4}$', -- CP9652, GW0089
    ARRAY[
      'Надпись "SPLY-350": зеркальная (читается справа налево с правой стороны)',
      'Knit pattern на верхе: ровный без пропусков, primeknit плотный',
      'Heel tab: чёткая форма, фирменная вышивка',
      'BOOST подошва: пористая, с мелкими ячейками',
      'Стелька: текст "ADIDAS" + размер чёткий, без размытия',
      'Боковая полоса с SPLY-350: ровные края, контрастная'
    ],
    ARRAY[
      'SPLY-350: правильное направление (не зеркальное) — это копия',
      'Primeknit: видны пропуски в плетении или нити торчат',
      'BOOST подошва: гладкая поверхность (вместо пористой)',
      'Heel tab: формальные пропорции нарушены',
      'Цвет подошвы: желтоватый оттенок BOOST вместо белого'
    ],
    ARRAY['Yeezy 350', 'YZY 350', 'изи буст 350'],
    'SPLY-350 ОБЯЗАНА быть зеркальной с одной стороны — это #1 признак.'),

  ((SELECT id FROM legit_check_brands WHERE slug='adidas'), 'yeezy-boost-700', 'Yeezy Boost 700', 'sneakers',
    '^[A-Z]{1,3}[0-9]{4}$',
    ARRAY[
      'Многослойный верх: чёткое разделение материалов (mesh + suede + leather)',
      'BOOST подошва: видна через окошки в подошве, пористая',
      'Heel tab: вышивка "ADIDAS" с правильным шрифтом',
      'Замша: натуральная, не блестящая'
    ],
    ARRAY[
      'BOOST через окошки: гладкая или однотонная',
      'Замша: блестящая пластиковая',
      'Heel tab: принт вместо вышивки'
    ],
    ARRAY['Yeezy 700', 'изи 700'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='adidas'), 'yeezy-slide', 'Yeezy Slide', 'sneakers',
    '^[A-Z]{1,3}[0-9]{4}$',
    ARRAY[
      'Foam (EVA): монолитная отливка, без швов',
      'Boost-эффект пены: упругий, не каменный',
      'Logo "ADIDAS" на пятке: рельефный, ровный шрифт'
    ],
    ARRAY[
      'EVA: видны швы или линии раздела',
      'Пена: твёрдая или мягкая (на оригинале — средняя)',
      'Logo на пятке: размыт или сдвинут'
    ],
    ARRAY['Yeezy Slide', 'изи слайды'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='adidas'), 'yeezy-foam-runner', 'Yeezy Foam RNR', 'sneakers',
    '^[A-Z]{1,3}[0-9]{4}$',
    ARRAY[
      'Дырки в дизайне: ровно круглые, одинакового диаметра',
      'EVA-пена: однородная плотность',
      'Стелька внутри: чёткий шрифт "Yeezy"'
    ],
    ARRAY[
      'Дырки: разного размера или неровные',
      'EVA: видны места стыков',
      'Стелька: размытый шрифт'
    ],
    ARRAY['Foam Runner', 'фоам раннер'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='adidas'), 'samba-og', 'Adidas Samba OG', 'sneakers',
    '^[A-Z]{1,3}[0-9]{4,5}$', -- B75806, IE3439
    ARRAY[
      'Замша: премиум, мягкая, с натуральной текстурой',
      'Три полоски: ровная ширина, симметричное расположение',
      'Гум подошва: жёлтая, чёткий узор протектора',
      'Языковая бирка: "Samba" вышита, не нашита',
      'Toe-cap: округлый, не плоский',
      'Trefoil логотип на задней части: чёткий'
    ],
    ARRAY[
      'Замша: пластиковая на ощупь, блестит',
      'Три полоски: разной ширины или несимметричные',
      'Подошва: матовая желтизна (на оригинале — более прозрачная)',
      'Языковая бирка: принт вместо вышивки',
      'Toe-cap: плоский или несимметричный'
    ],
    ARRAY['Samba', 'Samba OG', 'самба'],
    'Samba — главный хайп 2024-2025. Тоже самая копируемая модель Adidas.'),

  ((SELECT id FROM legit_check_brands WHERE slug='adidas'), 'gazelle-indoor', 'Adidas Gazelle Indoor', 'sneakers',
    '^[A-Z]{1,3}[0-9]{4,5}$',
    ARRAY[
      'Замша: натуральная, мягкая',
      'Подошва: гум, с протектором',
      'Trefoil: вышит',
      'Шнурки: круглые'
    ],
    ARRAY[
      'Замша: блестящая или пластиковая',
      'Trefoil: принт',
      'Подошва: твёрдая резина без гум-структуры'
    ],
    ARRAY['Gazelle', 'газель'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='adidas'), 'stan-smith', 'Adidas Stan Smith', 'sneakers',
    '^[A-Z]{1,3}[0-9]{4,5}$', -- M20324
    ARRAY[
      'Кожа: натуральная, гладкая, не пластиковая',
      'Перфорация трёх полос: 22 отверстия на каждой стороне (ровно)',
      'Языковая бирка: фото/гравюра Стэна Смита',
      'Задник: зелёный/синий цвет точный, текст "Stan Smith" ровный'
    ],
    ARRAY[
      'Перфорация: не 22 отверстия или неровные',
      'Кожа: пластиковая',
      'Бирка с фото Стэна: размытое или другой ракурс',
      'Цвет задника: бледный'
    ],
    ARRAY['Stan Smith', 'стэн смит'],
    'Подсчёт отверстий в перфорации — быстрый и надёжный тест.'),

  ((SELECT id FROM legit_check_brands WHERE slug='adidas'), 'superstar', 'Adidas Superstar', 'sneakers',
    '^[A-Z]{1,3}[0-9]{4,5}$',
    ARRAY[
      'Shell toe (резиновый носок): рельефный, с чёткими гранями',
      'Кожа: натуральная',
      'Три полоски: симметричные, перфорированные правильно',
      'Trefoil на задней части: вышит'
    ],
    ARRAY[
      'Shell toe: плоский или с размытыми гранями',
      'Кожа: пластиковая',
      'Trefoil: принт'
    ],
    ARRAY['Superstar', 'суперстар'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='adidas'), 'campus-00s', 'Adidas Campus 00s', 'sneakers',
    '^[A-Z]{1,3}[0-9]{4,5}$',
    ARRAY[
      'Замша: премиум, мягкая',
      'Три полоски: суженные у носка, симметричные',
      'Trefoil вышит',
      'Гум подошва: ровная, чёткий протектор'
    ],
    ARRAY[
      'Замша: грубая или блестящая',
      'Полоски: разной ширины',
      'Trefoil: принт'
    ],
    ARRAY['Campus', 'кампус'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='adidas'), 'forum-low', 'Adidas Forum Low', 'sneakers',
    '^[A-Z]{1,3}[0-9]{4,5}$',
    ARRAY[
      'Кожа: натуральная',
      'Strap (липучка) у щиколотки: ровно пришит',
      'Trefoil на язычке: чёткий'
    ],
    ARRAY[
      'Кожа: пластиковая',
      'Strap: неровно пришит',
      'Trefoil: размытый'
    ],
    ARRAY['Forum', 'форум'],
    NULL);

-- ============================================================================
-- 4. МОДЕЛИ — STONE ISLAND (10)
-- ============================================================================
-- Главный артефакт у всех — компас-бэдж. Базовые проверки в common_red_flags бренда.

INSERT INTO legit_check_models (brand_id, slug, name, category, auth_markers, red_flags, aliases, notes) VALUES
  ((SELECT id FROM legit_check_brands WHERE slug='stone-island'), 'compass-patch-hoodie', 'Compass Patch Hoodie', 'hoodie',
    ARRAY[
      'Бэдж компаса: вышивка матовая, не блестит',
      'Засечки на букве "A" в STONE ISLAND: изогнутые',
      'Цвет нитей: приглушённый жёлтый + тёмно-зелёный (не неоновый)',
      'Кулиска худи: плоская, не круглая',
      'Care label внутри: содержит лазерный логотип и дату производства',
      'Молнии: YKK (если есть)'
    ],
    ARRAY[
      'Бэдж: блестит при наклоне (на оригинале матовый)',
      'Компас на обратной стороне бэджа: утолщённый, грубый',
      'Засечки на A: прямые',
      'Care label: нет лазерного логотипа или дата отсутствует'
    ],
    ARRAY['Stone Island Hoodie', 'SI hoodie', 'стон айленд худи'],
    'Главная модель Stone Island. Бэдж — единственный надёжный признак для AI.'),

  ((SELECT id FROM legit_check_brands WHERE slug='stone-island'), 'garment-dyed-crewneck', 'Garment Dyed Crewneck Sweatshirt', 'sweatshirt',
    ARRAY[
      'Бэдж компаса: матовая вышивка, изогнутые засечки на A',
      'Garment dye эффект: неоднородный окрас, мелкие потёртости естественные',
      'Care label: код артикула + дата'
    ],
    ARRAY[
      'Окрас: слишком ровный (нет эффекта garment dye)',
      'Бэдж: блестящие нити',
      'Care label: без даты'
    ],
    ARRAY['SI crewneck', 'стон айленд свитшот'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='stone-island'), 'hooded-down-jacket', 'Hooded Down Jacket', 'jacket',
    ARRAY[
      'Бэдж компаса на рукаве: матовая вышивка',
      'Пух: equal-fill (равномерное распределение)',
      'Молнии: YKK с логотипом',
      'Care label с лазерной маркировкой'
    ],
    ARRAY[
      'Пух: комки или неравномерность',
      'Молнии: не YKK или без гравировки',
      'Бэдж: блестящие нити'
    ],
    ARRAY['SI down jacket', 'стон айленд пуховик'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='stone-island'), 'reflective-knit-hat', 'Reflective Knit Hat', 'accessory',
    ARRAY[
      'Светоотражающий бэдж: вспыхивает под фонариком',
      'Шапка: толстая вязка',
      'Этикетка с артикулом внутри'
    ],
    ARRAY[
      'Бэдж не вспыхивает (или вспыхивает слабо)',
      'Вязка тонкая, прозрачная',
      'Этикетка отсутствует или с опечатками'
    ],
    ARRAY['SI hat', 'стон айленд шапка'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='stone-island'), 'compass-tee', 'T-Shirt with Compass Logo', 't-shirt',
    ARRAY[
      'Бэдж компаса: матовая вышивка, изогнутые засечки на A',
      'Хлопок: плотный, ~250 gsm',
      'Care label внутри'
    ],
    ARRAY[
      'Бэдж: блестит',
      'Хлопок: тонкий',
      'Care label: без лазерной маркировки'
    ],
    ARRAY['SI tee', 'стон айленд футболка'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='stone-island'), 'cargo-pants', 'Cargo Pants', 'pants',
    ARRAY[
      'Бэдж компаса на боковом кармане: матовая вышивка',
      'Карго-карманы: ровные швы, аккуратные клапаны',
      'Молнии YKK с гравировкой',
      'Внутренняя бирка с лазерным логотипом'
    ],
    ARRAY[
      'Карманы: кривые швы',
      'Молнии: не YKK',
      'Бирка без лазера'
    ],
    ARRAY['SI cargo', 'стон айленд карго'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='stone-island'), 'naslan-light-jacket', 'Naslan Light Jacket', 'jacket',
    ARRAY[
      'Ткань NASLAN LIGHT: лёгкая, водоотталкивающая',
      'Бэдж компаса: матовая вышивка',
      'Молнии YKK',
      'Этикетка с указанием ткани NASLAN'
    ],
    ARRAY[
      'Ткань тяжёлая или хрустящая',
      'Молнии не YKK',
      'Этикетка без упоминания NASLAN'
    ],
    ARRAY['SI Nylon Metal', 'стон айленд найлон'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='stone-island'), 'shadow-project-piece', 'Shadow Project (general)', 'mixed',
    ARRAY[
      'Бирка Shadow Project: серый/чёрный с лазерной маркировкой',
      'Технологичные материалы: GORE-TEX / DYNEEMA с лицензионными этикетками',
      'Бэдж компаса: матовый'
    ],
    ARRAY[
      'Бирка Shadow Project: без лазерной маркировки',
      'GORE-TEX / DYNEEMA этикетки: фейковые шрифт/логотип',
      'Бэдж блестит'
    ],
    ARRAY['Shadow Project', 'SI Shadow'],
    'Shadow Project — премиальная техническая линия Stone Island. Реплики редкие, но дорогие ($300+).'),

  ((SELECT id FROM legit_check_brands WHERE slug='stone-island'), 'reflective-mask-jacket', 'Reflective Mask Jacket', 'jacket',
    ARRAY[
      'Светоотражающая ткань: ярко вспыхивает по всей поверхности под фонариком',
      'Маска-крышка с встроенными кнопками',
      'Бэдж компаса: матовый, светоотражающий по краям'
    ],
    ARRAY[
      'Светоотражение тусклое или неоднородное',
      'Маска: пластиковые кнопки (на оригинале — металлические)',
      'Бэдж не светится по краям'
    ],
    ARRAY['SI Reflective Mask'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='stone-island'), 'marina-plated-sweatshirt', 'Marina Plated Sweatshirt', 'sweatshirt',
    ARRAY[
      'Покрытие Plated: лёгкий металлический отблеск, неоднородный',
      'Бэдж компаса: матовый',
      'Care label с указанием Marina + Plated'
    ],
    ARRAY[
      'Покрытие слишком ровное или блестит как пластик',
      'Care label без упоминания Marina/Plated'
    ],
    ARRAY['SI Marina'],
    NULL);

-- ============================================================================
-- 5. МОДЕЛИ — STÜSSY (10)
-- ============================================================================

INSERT INTO legit_check_models (brand_id, slug, name, category, auth_markers, red_flags, aliases, notes) VALUES
  ((SELECT id FROM legit_check_brands WHERE slug='stussy'), '8-ball-tee', 'Stüssy 8 Ball Tee', 't-shirt',
    ARRAY[
      'Принт 8-ball: чёткие края, без потёков',
      'Хлопок: плотный, ~210 gsm',
      'Шейная бирка: "Stüssy" с одинаковой толщиной букв',
      'Точки на ü ромбовидные',
      'Care label: содержит "Made in" с конкретной страной'
    ],
    ARRAY[
      '8-ball: размытые края, цвет потёк',
      'Шейная бирка: разная толщина букв',
      'Точки на ü квадратные'
    ],
    ARRAY['Stussy 8 Ball'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='stussy'), 'world-tour-tee', 'Stüssy World Tour Tee', 't-shirt',
    ARRAY[
      'Принт городов на спине: чёткий, ровные строки',
      'Лого спереди: одинаковая толщина букв',
      'Шейная бирка с правильной "ü"'
    ],
    ARRAY[
      'Принт городов: смещён или с опечатками в названиях',
      'Логотип спереди: тоньше с одной стороны'
    ],
    ARRAY['Stussy World Tour'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='stussy'), 'basic-tee', 'Stüssy Basic Tee', 't-shirt',
    ARRAY[
      'Лого: чёткий, одинаковая толщина букв',
      'Хлопок плотный',
      'Шейная бирка стандартная'
    ],
    ARRAY[
      'Лого: разная толщина букв',
      'Хлопок тонкий, просвечивает'
    ],
    ARRAY['Stussy basic'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='stussy'), 'crown-hoodie', 'Stüssy Crown Hoodie', 'hoodie',
    ARRAY[
      'Корона над логотипом: чёткая, симметричная',
      'Хлопок худи: плотный, ~400 gsm',
      'Шнурки кулиски: специфическая фактура',
      'Шейная бирка: правильная ü'
    ],
    ARRAY[
      'Корона: асимметричная или размытая',
      'Шнурки: другая фактура',
      'ü на бирке: квадратные точки'
    ],
    ARRAY['Stussy Crown'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='stussy'), 'stock-logo-hoodie', 'Stüssy Stock Logo Hoodie', 'hoodie',
    ARRAY[
      'Stock logo (вертикальный): ровный, букв одинаковой толщины',
      'Хлопок плотный',
      'Шейная бирка: правильная ü, t изогнута'
    ],
    ARRAY[
      'Stock logo: разная толщина букв',
      'ü: квадратные точки',
      't на бирке: прямая, без загиба'
    ],
    ARRAY['Stussy stock'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='stussy'), 'cardigan', 'Stüssy Cardigan', 'cardigan',
    ARRAY[
      'Пуговицы: качественные, с гравировкой',
      'Вышивка логотипа: ровная',
      'Шерсть/хлопок плотный'
    ],
    ARRAY[
      'Пуговицы: пластиковые без гравировки',
      'Вышивка размытая'
    ],
    ARRAY['Stussy cardigan'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='stussy'), 'big-logo-tee', 'Stüssy Big Logo Tee', 't-shirt',
    ARRAY[
      'Большой принт логотипа: ровный, без размытий',
      'Все буквы одинаковой font-weight',
      'Шейная бирка стандартная'
    ],
    ARRAY[
      'Принт: с размытыми краями',
      'Разная толщина букв'
    ],
    ARRAY['Stussy big logo'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='stussy'), 'bucket-hat', 'Stüssy Bucket Hat', 'accessory',
    ARRAY[
      'Вышивка лого на ободе: ровные стежки',
      'Хлопок/нейлон плотный',
      'Внутренняя бирка с правильным написанием Stüssy'
    ],
    ARRAY[
      'Вышивка кривая',
      'Бирка с неправильной ü',
      'Материал тонкий'
    ],
    ARRAY['Stussy bucket'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='stussy'), 'snapback', 'Stüssy Snapback', 'accessory',
    ARRAY[
      'Вышивка логотипа спереди: чёткая, объёмная',
      'Регулятор-снапбэк: пластик с гравировкой бренда',
      'Внутренняя бирка'
    ],
    ARRAY[
      'Вышивка плоская или размытая',
      'Снапбэк без гравировки',
      'Бирка отсутствует'
    ],
    ARRAY['Stussy snapback', 'Stussy cap'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='stussy'), 'nike-collab', 'Stüssy x Nike (collab)', 'mixed',
    ARRAY[
      'Со-брендинг: оба логотипа чёткие, правильное написание',
      'Стиль-код Nike: формат соответствует году выпуска',
      'Этикетки с двумя брендами'
    ],
    ARRAY[
      'Лого Stüssy с ошибкой',
      'Стиль-код Nike нелогичный для года',
      'Этикетки только одного бренда'
    ],
    ARRAY['Stussy Nike'],
    'Коллабы Stüssy x Nike — самые подделываемые. Двойная проверка.');

-- ============================================================================
-- 6. МОДЕЛИ — CARHARTT WIP (10)
-- ============================================================================

INSERT INTO legit_check_models (brand_id, slug, name, category, sku_pattern, auth_markers, red_flags, aliases, notes) VALUES
  ((SELECT id FROM legit_check_brands WHERE slug='carhartt-wip'), 'detroit-jacket', 'OG Detroit Jacket', 'jacket',
    '^I0[0-9]{5}$', -- I036259
    ARRAY[
      'Артикул: формат I0XXXXX (например I036259)',
      'Square Label (квадратный лейбл): "Carhartt WIP" с чётким шрифтом',
      'Молнии: YKK с гравировкой',
      'Подкладка: ромбовидная стёжка, плотная',
      'Воротник: вельвет/cotton, мягкий, не скрипит',
      'Манжеты: регулируемые, с фирменными кнопками'
    ],
    ARRAY[
      'Артикул не I0XXXXX',
      'Square Label с другим шрифтом',
      'Молнии не YKK',
      'Подкладка тонкая или ромб неровный',
      'Кнопки манжет без гравировки'
    ],
    ARRAY['Detroit Jacket', 'детройт жакет', 'детройт картхарт'],
    'Detroit Jacket — самая копируемая модель Carhartt WIP.'),

  ((SELECT id FROM legit_check_brands WHERE slug='carhartt-wip'), 'active-jacket', 'Active Jacket (Hooded)', 'jacket',
    '^I0[0-9]{5}$',
    ARRAY[
      'Артикул I0XXXXX',
      'Square Label',
      'Молнии YKK',
      'Капюшон с регулировкой',
      'Подкладка тёплая, ромб'
    ],
    ARRAY[
      'Артикул некорректный',
      'Молнии не YKK',
      'Подкладка тонкая'
    ],
    ARRAY['Active hooded'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='carhartt-wip'), 'chase-sweatshirt', 'Chase Sweatshirt', 'sweatshirt',
    '^I0[0-9]{5}$',
    ARRAY[
      'Артикул I0XXXXX',
      'Вышивка "C" на груди: ровная',
      'Манжеты и пояс: плотная резинка',
      'Square Label'
    ],
    ARRAY[
      'Артикул неверный',
      'Вышивка "C" размытая',
      'Резинка тонкая'
    ],
    ARRAY['Chase sweatshirt'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='carhartt-wip'), 'chase-tee', 'Chase T-Shirt', 't-shirt',
    '^I0[0-9]{5}$',
    ARRAY[
      'Артикул I0XXXXX',
      'Вышивка "C" на груди: ровная',
      'Хлопок плотный',
      'Care label с лазером'
    ],
    ARRAY[
      'Артикул некорректный',
      'Вышивка "C" размытая',
      'Хлопок тонкий'
    ],
    ARRAY['Chase tee'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='carhartt-wip'), 'watch-hat', 'Watch Hat (Acrylic)', 'accessory',
    '^I0[0-9]{5}$',
    ARRAY[
      'Артикул I0XXXXX',
      'Square Label сбоку: чёткий шрифт',
      'Акриловая вязка: плотная',
      'Размер вышит на этикетке'
    ],
    ARRAY[
      'Square Label с другим шрифтом',
      'Вязка тонкая',
      'Размер не указан'
    ],
    ARRAY['Carhartt beanie', 'картхарт шапка'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='carhartt-wip'), 'single-knee-pant', 'Carhartt Single Knee Pant', 'pants',
    '^I0[0-9]{5}$',
    ARRAY[
      'Артикул I0XXXXX',
      'Усиленная панель на колене (одинарная)',
      'Молнии YKK',
      'Кнопки/заклёпки с гравировкой Carhartt',
      'Square Label на боковом кармане'
    ],
    ARRAY[
      'Артикул неверный',
      'Усиление на колене из тонкого материала',
      'Кнопки без гравировки',
      'Молнии не YKK'
    ],
    ARRAY['Single Knee', 'сингл ни'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='carhartt-wip'), 'master-pant', 'Master Pant', 'pants',
    '^I0[0-9]{5}$',
    ARRAY[
      'Артикул I0XXXXX',
      'Хлопковая саржа: плотная',
      'Square Label на боковом кармане',
      'Регулируемая талия'
    ],
    ARRAY[
      'Хлопок тонкий',
      'Square Label с другим шрифтом'
    ],
    ARRAY['Master pant'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='carhartt-wip'), 'og-active-vest', 'Carhartt OG Active Vest', 'vest',
    '^I0[0-9]{5}$',
    ARRAY[
      'Артикул I0XXXXX',
      'Подкладка ромб',
      'Square Label на груди',
      'Молнии YKK'
    ],
    ARRAY[
      'Артикул неверный',
      'Подкладка плоская',
      'Молнии не YKK'
    ],
    ARRAY['Carhartt vest'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='carhartt-wip'), 'kickflip-backpack', 'Carhartt Kickflip Backpack', 'bag',
    '^I0[0-9]{5}$',
    ARRAY[
      'Артикул I0XXXXX',
      'Молнии YKK',
      'Square Label на лицевой части',
      'Подкладка с фирменным принтом',
      'Лямки с регулировкой'
    ],
    ARRAY[
      'Молнии не YKK',
      'Square Label другим шрифтом',
      'Подкладка без принта'
    ],
    ARRAY['Kickflip', 'картхарт рюкзак'],
    NULL),

  ((SELECT id FROM legit_check_brands WHERE slug='carhartt-wip'), 'pocket-tee', 'Carhartt WIP S/S Pocket Tee', 't-shirt',
    '^I0[0-9]{5}$',
    ARRAY[
      'Артикул I0XXXXX',
      'Square Label на нагрудном кармане',
      'Хлопок ~200 gsm',
      'Care label с лазером и датой'
    ],
    ARRAY[
      'Артикул неверный',
      'Хлопок тонкий',
      'Square Label с другим шрифтом'
    ],
    ARRAY['Carhartt pocket tee', 'картхарт футболка карман'],
    NULL);
