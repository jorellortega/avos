-- Shopping list vs on-hand stock + seed Avos default lists.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS list_kind text NOT NULL DEFAULT 'stock'
    CHECK (list_kind IN ('stock', 'shopping'));

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS purchased boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS inventory_items_list_kind_sort_idx
  ON public.inventory_items (list_kind, purchased, sort_order, id);

COMMENT ON COLUMN public.inventory_items.list_kind IS 'stock = on hand; shopping = need to buy.';
COMMENT ON COLUMN public.inventory_items.notes IS 'Amount on hand (stock) or amount/notes to buy (shopping).';

-- Seed only when empty (safe to re-run migration).
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.inventory_items) > 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.inventory_items (name, notes, list_kind, sort_order, unit, quantity) VALUES
    ('Sea salt', '1 bag', 'shopping', 0, 'pza', 0),
    ('Tocino suelto', 'Buy', 'shopping', 1, 'pza', 0),
    ('Onions', 'Need more; only 2 left', 'shopping', 2, 'pza', 0),
    ('Avocados', 'Have 6; need about 14–20 for the day', 'shopping', 3, 'pza', 0),
    ('Cream', 'Need more; only bottle leftovers', 'shopping', 4, 'pza', 0),
    ('Cabbage', 'None', 'shopping', 5, 'pza', 0),
    ('Sugar', 'Have 1 kilo; need 3 kilos total for the day', 'shopping', 6, 'kg', 0),
    ('Small sauce bottles + lids', 'Need more', 'shopping', 7, 'pza', 0),
    ('Big sauce containers + lids', 'Need', 'shopping', 8, 'pza', 0),
    ('Napkins', 'Have 1 full; need 1 backup', 'shopping', 9, 'pza', 0),
    ('Ice', 'Need 3 bags', 'shopping', 10, 'pza', 0),
    ('Chipotle container', 'Need', 'shopping', 11, 'pza', 0),
    ('Gas', 'Check big and small tanks', 'shopping', 12, 'pza', 0),
    ('Franelas', 'Need more', 'shopping', 13, 'pza', 0),
    ('Hair nets / rubber bands', 'Need', 'shopping', 14, 'pza', 0),
    ('Water bottles', 'Need; sodas are full', 'shopping', 15, 'pza', 0),
    ('Spray bottle / rociador', 'Need', 'shopping', 16, 'pza', 0),
    ('Dish soap', 'Need', 'shopping', 17, 'pza', 0),
    ('Dish wash cloth', 'Need', 'shopping', 18, 'pza', 0),
    ('Pineapple', 'Have half; need 3 daily if making pineapple water, otherwise 1 for recipes', 'shopping', 19, 'pza', 0),
    ('Menu signs', 'Need signs for rest of menu', 'shopping', 20, 'pza', 0),
    ('Menu', 'Need', 'shopping', 21, 'pza', 0),
    ('TV', 'For menu or ads', 'shopping', 22, 'pza', 0),
    ('Oregano suelto', '$20', 'shopping', 23, 'pza', 0),
    ('Comino suelto', '$20', 'shopping', 24, 'pza', 0),
    ('Paprika', 'Buy big one', 'shopping', 25, 'pza', 0),
    ('Soy sauce Maggi brand', '1 big bottle', 'shopping', 26, 'pza', 0),
    ('Sal con ajo', '1', 'shopping', 27, 'pza', 0),
    ('Sazonador / sabroseador', '1', 'shopping', 28, 'pza', 0),
    ('Olive oil', '1 more', 'shopping', 29, 'pza', 0),
    ('Honey for chicken', 'Need', 'shopping', 30, 'pza', 0),
    ('Chile guajillo colorado', '$50', 'shopping', 31, 'pza', 0),
    ('Tomatillo / tomate de hoja green', '$30', 'shopping', 32, 'pza', 0);

  INSERT INTO public.inventory_items (name, notes, list_kind, sort_order, unit, quantity) VALUES
    ('Tomatoes', '1 kilo', 'stock', 0, 'kg', 1),
    ('Limones', '1 kilo', 'stock', 1, 'kg', 1),
    ('Tortilla de harina grande', '3 kilos', 'stock', 2, 'kg', 3),
    ('Red sauce', '1 full bottle + 1 leftover', 'stock', 3, 'pza', 1),
    ('Mayonnaise', 'Lleno', 'stock', 4, 'pza', 1),
    ('Cilantro', 'A lot', 'stock', 5, 'pza', 1),
    ('Quesadilla cheese', '3 full + half', 'stock', 6, 'pza', 1),
    ('Lettuce', '1.5', 'stock', 7, 'pza', 1),
    ('Shrimp / camarón', '1 kilo', 'stock', 8, 'kg', 1),
    ('Olive oil', '1 full bottle', 'stock', 9, 'pza', 1),
    ('Rice', 'Pots full', 'stock', 10, 'pza', 1),
    ('Beans', 'Pots full', 'stock', 11, 'pza', 1),
    ('Torta bread', 'A lot', 'stock', 12, 'pza', 1),
    ('Cucumber', '1 left', 'stock', 13, 'pza', 1),
    ('Big water gallons', '5', 'stock', 14, 'pza', 5),
    ('Butter', '2 full', 'stock', 15, 'pza', 2),
    ('Steak / arrachera', '4 kilos', 'stock', 16, 'kg', 4),
    ('Oranges', '8', 'stock', 17, 'pza', 8),
    ('Straws', 'A lot', 'stock', 18, 'pza', 1),
    ('Sodas', 'Lleno', 'stock', 19, 'pza', 1),
    ('Bleach', '1 small', 'stock', 20, 'pza', 1),
    ('Fabuloso', '1 small', 'stock', 21, 'pza', 1),
    ('Aluminum', '1 full', 'stock', 22, 'pza', 1),
    ('Soy sauce', '2 full', 'stock', 23, 'pza', 2),
    ('Water concentrates', 'Limón, piña, fresa', 'stock', 24, 'pza', 1),
    ('Beer for micheladas', 'Available', 'stock', 25, 'pza', 1),
    ('Michelada prep', 'Available', 'stock', 26, 'pza', 1),
    ('Ensenada sauce', 'In sauce bottle + leftover backup cup', 'stock', 27, 'pza', 1),
    ('Ventilador', 'Available', 'stock', 28, 'pza', 1);
END $$;
