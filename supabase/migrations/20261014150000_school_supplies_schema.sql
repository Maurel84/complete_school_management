-- Migration: School Supplies & Books by Class & Academic Year
CREATE TABLE IF NOT EXISTS school_supplies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    level_id UUID REFERENCES levels(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'manuel', -- 'manuel', 'cahier', 'papeterie', 'geometrie', 'uniforme', 'autre'
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL NOT NULL DEFAULT 0,
    is_mandatory BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE school_supplies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow school users to manage school_supplies" 
ON school_supplies FOR ALL 
USING (school_id = current_profile_school_id());

-- Indexes for ultra-fast filtering
CREATE INDEX IF NOT EXISTS idx_school_supplies_class_year ON school_supplies(school_id, academic_year_id, class_id);
