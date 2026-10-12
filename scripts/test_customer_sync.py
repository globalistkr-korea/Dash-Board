"""Guards that prevent malformed or truncated sources from replacing published data."""
import copy
import unittest
from import_customer_pnl import amount, SOURCE_ID
from sync_customer_pnl import canonical, validate_transition

class SourceGuards(unittest.TestCase):
    def setUp(self):
        self.sample = {'years':['2025','2026'], 'actualMonths':{'2025':12,'2026':8},
            'source':{'spreadsheetId':SOURCE_ID,'importedAt':'first','rowCounts':{'2025':100,'2026':80},
                      'months':{'2025':list(range(1,13)),'2026':list(range(1,9))}},
            'customers':{'customer':{}},'warehouses':{'warehouse':{}}}
    def test_same_export_timestamp_is_not_a_data_change(self):
        new=copy.deepcopy(self.sample);new['source']['importedAt']='second'
        self.assertEqual(canonical(new),canonical(self.sample))
    def test_new_month_accepted(self):
        new=copy.deepcopy(self.sample);new['actualMonths']['2026']=9;new['source']['months']['2026'].append(9)
        validate_transition(self.sample,new)
    def test_removed_history_period_rows_and_gaps_rejected(self):
        for mutation in [lambda x:x['years'].remove('2025'),lambda x:x['actualMonths'].update({'2026':7}),
                         lambda x:x['source']['rowCounts'].update({'2026':20}),
                         lambda x:x['source']['months']['2026'].remove(3)]:
            with self.subTest(mutation=mutation):
                new=copy.deepcopy(self.sample);mutation(new)
                with self.assertRaises(ValueError):validate_transition(self.sample,new)
    def test_existing_numeric_conventions_and_invalid_values(self):
        self.assertEqual(amount('1.234.567'),1234567)
        self.assertEqual(amount('(1,234)'),-1234)
        self.assertEqual(amount(None),0)
        for value in ['#VALUE!','NaN',float('inf')]:
            with self.assertRaises(ValueError):amount(value)

if __name__=='__main__':unittest.main()
