import { supabase } from './supabase';

interface DoubleEntryParams {
  schoolId: string;
  amount: number;
  description: string;
  debitAccountNo: string;
  creditAccountNo: string;
  reference?: string;
}

export async function createDoubleEntry({
  schoolId,
  amount,
  description,
  debitAccountNo,
  creditAccountNo,
  reference = '',
}: DoubleEntryParams) {
  try {
    // 1. Fetch account UUIDs by their numbers
    const { data: accounts, error: fetchError } = await supabase
      .from('accounting_accounts')
      .select('id, account_number')
      .eq('school_id', schoolId)
      .in('account_number', [debitAccountNo, creditAccountNo]);

    if (fetchError || !accounts || accounts.length < 2) {
      console.warn("Accounting accounts not found, skipping double entry sync.", fetchError);
      return;
    }

    const debitAcc = accounts.find(a => a.account_number === debitAccountNo);
    const creditAcc = accounts.find(a => a.account_number === creditAccountNo);

    if (!debitAcc || !creditAcc) return;

    const entryNumber = `ECR-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];

    // 2. Insert Debit and Credit entries
    const { error: insertError } = await supabase.from('accounting_entries').insert([
      {
        school_id: schoolId,
        account_id: debitAcc.id,
        entry_number: entryNumber,
        debit: amount,
        credit: 0,
        description,
        entry_date: today,
        reference,
      },
      {
        school_id: schoolId,
        account_id: creditAcc.id,
        entry_number: entryNumber,
        debit: 0,
        credit: amount,
        description,
        entry_date: today,
        reference,
      }
    ]);

    if (insertError) throw insertError;
  } catch (err) {
    console.error("Failed to sync double entry", err);
  }
}

export async function createCashTransaction({
  schoolId,
  type,
  amount,
  description,
  category,
  processedBy = null,
}: {
  schoolId: string;
  type: 'in' | 'out';
  amount: number;
  description: string;
  category: string;
  processedBy?: string | null;
}) {
  try {
    // Try to find if there is an active open register
    let activeRegisterId: string | null = null;
    const { data: registers } = await supabase
      .from('cash_registers')
      .select('id')
      .eq('school_id', schoolId)
      .eq('status', 'open')
      .limit(1);
    
    if (registers && registers.length > 0) {
      activeRegisterId = registers[0].id;
    }

    const { error: insertError } = await supabase.from('cash_transactions').insert({
      school_id: schoolId,
      cash_register_id: activeRegisterId,
      transaction_number: `TRX-${Date.now()}`,
      type,
      amount,
      description,
      category,
      validated: true,
      processed_by: processedBy,
    });

    if (insertError) throw insertError;
  } catch (err) {
    console.error("Failed to create cash transaction", err);
  }
}
