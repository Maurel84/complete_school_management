import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Class } from '../types';

export function useClasses(schoolId?: string) {
  return useQuery({
    queryKey: ['classes', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', schoolId)
        .order('name');

      if (error) throw error;
      return (data as Class[]) || [];
    },
    enabled: !!schoolId,
  });
}
