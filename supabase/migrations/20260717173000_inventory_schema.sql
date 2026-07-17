-- Create inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_threshold INTEGER NOT NULL DEFAULT 5,
    unit_price DECIMAL NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow school users to manage inventory_items" 
ON inventory_items FOR ALL 
USING (school_id = current_profile_school_id());

-- Create inventory_transactions table
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL, -- 'in' (restock) or 'out' (usage/sale)
    quantity INTEGER NOT NULL,
    unit_price DECIMAL NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow school users to manage inventory_transactions" 
ON inventory_transactions FOR ALL 
USING (school_id = current_profile_school_id());

-- Populate standard school items for all schools
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM schools LOOP
        -- Tissu du lundi
        IF NOT EXISTS (SELECT 1 FROM inventory_items WHERE school_id = r.id AND name = 'Tissu du lundi') THEN
            INSERT INTO inventory_items (school_id, name, quantity, min_threshold, unit_price) 
            VALUES (r.id, 'Tissu du lundi', 50, 10, 5000);
        END IF;
        
        -- Tenue de sport
        IF NOT EXISTS (SELECT 1 FROM inventory_items WHERE school_id = r.id AND name = 'Tenue de sport') THEN
            INSERT INTO inventory_items (school_id, name, quantity, min_threshold, unit_price) 
            VALUES (r.id, 'Tenue de sport', 40, 10, 4000);
        END IF;

        -- Macaron
        IF NOT EXISTS (SELECT 1 FROM inventory_items WHERE school_id = r.id AND name = 'Macaron') THEN
            INSERT INTO inventory_items (school_id, name, quantity, min_threshold, unit_price) 
            VALUES (r.id, 'Macaron', 100, 20, 1000);
        END IF;

        -- Livres & Manuels
        IF NOT EXISTS (SELECT 1 FROM inventory_items WHERE school_id = r.id AND name = 'Manuels scolaires') THEN
            INSERT INTO inventory_items (school_id, name, quantity, min_threshold, unit_price) 
            VALUES (r.id, 'Manuels scolaires', 20, 5, 12000);
        END IF;
    END LOOP;
END $$;
