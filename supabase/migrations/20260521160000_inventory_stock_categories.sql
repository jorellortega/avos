-- Assign stock items to inventario categories (cards on /inventario-edit).

UPDATE public.inventory_items SET category = 'Tomates y vegetales'
WHERE list_kind = 'stock' AND name IN (
  'Tomatoes', 'Limones', 'Cilantro', 'Lettuce', 'Cucumber', 'Oranges'
);

UPDATE public.inventory_items SET category = 'Proteínas'
WHERE list_kind = 'stock' AND name IN ('Shrimp / camarón', 'Steak / arrachera');

UPDATE public.inventory_items SET category = 'Lácteos'
WHERE list_kind = 'stock' AND name IN ('Quesadilla cheese', 'Butter', 'Mayonnaise');

UPDATE public.inventory_items SET category = 'Salsas'
WHERE list_kind = 'stock' AND name IN (
  'Red sauce', 'Soy sauce', 'Ensenada sauce', 'Michelada prep'
);

UPDATE public.inventory_items SET category = 'Bebidas'
WHERE list_kind = 'stock' AND name IN (
  'Sodas', 'Beer for micheladas', 'Water concentrates', 'Big water gallons'
);

UPDATE public.inventory_items SET category = 'Despensa'
WHERE list_kind = 'stock' AND name IN (
  'Tortilla de harina grande', 'Rice', 'Beans', 'Torta bread', 'Olive oil'
);

UPDATE public.inventory_items SET category = 'Limpieza y suministros'
WHERE list_kind = 'stock' AND name IN (
  'Straws', 'Bleach', 'Fabuloso', 'Aluminum', 'Ventilador'
);

UPDATE public.inventory_items SET category = 'Otros'
WHERE list_kind = 'stock' AND (category IS NULL OR trim(category) = '');
