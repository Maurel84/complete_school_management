import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Parent } from '../types';

export function useParents(schoolId?: string) {
  return useQuery({
    queryKey: ['parents', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('parents')
        .select('*')
        .eq('school_id', schoolId)
        .order('last_name');

      if (error) throw error;
      return (data as Parent[]) || [];
    },
    enabled: !!schoolId,
  });
}
