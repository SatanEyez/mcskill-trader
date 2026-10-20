export interface SeedResource {
  name: string;
  min_price: number;
  image_url: string;
  category: string;
}

/**
 * Стартовый набор ресурсов McSkill OneBlock.
 * image_url указывает на локальные текстуры в client/public/items.
 */
export const seedResources: SeedResource[] = [
  { name: 'Алмаз', min_price: 1200, image_url: '/items/diamond.png', category: 'Минералы' },
  { name: 'Изумруд', min_price: 950, image_url: '/items/emerald.png', category: 'Минералы' },
  { name: 'Железный слиток', min_price: 45, image_url: '/items/iron_ingot.png', category: 'Минералы' },
  { name: 'Золотой слиток', min_price: 160, image_url: '/items/gold_ingot.png', category: 'Минералы' },
  { name: 'Незеритовый слиток', min_price: 5200, image_url: '/items/netherite_ingot.png', category: 'Минералы' },
  { name: 'Уголь', min_price: 15, image_url: '/items/coal.png', category: 'Минералы' },
  { name: 'Красный камень', min_price: 22, image_url: '/items/redstone.png', category: 'Минералы' },
  { name: 'Лазурит', min_price: 70, image_url: '/items/lapis_lazuli.png', category: 'Минералы' },
  { name: 'Кварц Нижнего мира', min_price: 40, image_url: '/items/quartz.png', category: 'Минералы' },
  { name: 'Медный слиток', min_price: 30, image_url: '/items/copper_ingot.png', category: 'Минералы' },
  { name: 'Аметистовый осколок', min_price: 85, image_url: '/items/amethyst_shard.png', category: 'Минералы' },
  { name: 'Незеритовый скрап', min_price: 2100, image_url: '/items/netherite_scrap.png', category: 'Минералы' },
  { name: 'Древние обломки', min_price: 2400, image_url: '/items/ancient_debris_side.png', category: 'Блоки' },
  { name: 'Обсидиан', min_price: 28, image_url: '/items/obsidian.png', category: 'Блоки' },
  { name: 'Дубовое бревно', min_price: 8, image_url: '/items/oak_log.png', category: 'Блоки' },
  { name: 'Эхо-осколок', min_price: 900, image_url: '/items/echo_shard.png', category: 'Редкое' },
  { name: 'Звезда Нижнего мира', min_price: 14000, image_url: '/items/nether_star.png', category: 'Редкое' },
  { name: 'Тотем бессмертия', min_price: 7500, image_url: '/items/totem_of_undying.png', category: 'Редкое' },
  { name: 'Трезубец', min_price: 11000, image_url: '/items/trident.png', category: 'Редкое' },
  { name: 'Элитры', min_price: 26000, image_url: '/items/elytra.png', category: 'Редкое' },
  { name: 'Маяк', min_price: 38000, image_url: '/items/beacon.png', category: 'Редкое' },
  { name: 'Палочка ифрита', min_price: 240, image_url: '/items/blaze_rod.png', category: 'Мобы' },
  { name: 'Эндер-жемчуг', min_price: 180, image_url: '/items/ender_pearl.png', category: 'Мобы' },
  { name: 'Слизистый шарик', min_price: 50, image_url: '/items/slime_ball.png', category: 'Мобы' },
  { name: 'Порох', min_price: 35, image_url: '/items/gunpowder.png', category: 'Мобы' },
  { name: 'Осколок панциря', min_price: 3200, image_url: '/items/shulker_shell.png', category: 'Мобы' },
  { name: 'Зачарованное золотое яблоко', min_price: 4200, image_url: '/items/enchanted_golden_apple.png', category: 'Еда' },
  { name: 'Золотое яблоко', min_price: 750, image_url: '/items/golden_apple.png', category: 'Еда' },
  { name: 'Хлеб', min_price: 20, image_url: '/items/bread.png', category: 'Еда' },
  { name: 'Пшеница', min_price: 10, image_url: '/items/wheat.png', category: 'Еда' },
];
