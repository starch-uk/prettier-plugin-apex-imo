public class PrimitiveTypeTest {
    public void testPrimitives() {
        // Primitive types in various incorrect cases
        string str = 'test';
        integer num = 42;
        boolean flag = true;
        blob data = Blob.valueOf('test');
        date d = Date.today();
        datetime dt = Datetime.now();
        decimal dec = 3.14;
        double dbl = 3.14;
        id recordId = '001000000000000AAA';
        long lng = 1000L;
        object obj = 'test';
        time t = Time.newInstance(12, 0, 0, 0);
        sobject sobj = new Account();
        
        // Collection types in incorrect cases
        list<string> strings = new list<string>{ 'a', 'b' };
        set<integer> numbers = new set<integer>{ 1, 2, 3 };
        map<string, integer> counts = new map<string, integer>{ 'a' => 1 };
        
        // Generics with primitives in incorrect cases
        List<string> listOfStrings = new List<string>{ 'test' };
        Set<integer> setOfIntegers = new Set<integer>{ 1, 2 };
        Map<string, boolean> flags = new Map<string, boolean>{ 'key' => true };
        
        // Nested collections with primitives
        List<List<string>> nestedLists = new List<List<string>>{
            new List<string>{ 'a', 'b' }
        };
        Map<string, List<integer>> mapWithLists = new Map<string, List<integer>>{
            'key' => new List<integer>{ 1, 2, 3 }
        };
    }
}
