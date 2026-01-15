public class PrimitiveTypeTest {
  public void testPrimitives() {
    // Primitive types in various incorrect cases
    String str = 'test';
    Integer num = 42;
    Boolean flag = true;
    Blob data = Blob.valueOf('test');
    Date d = Date.today();
    Datetime dt = Datetime.now();
    Decimal dec = 3.14;
    Double dbl = 3.14;
    ID recordId = '001000000000000AAA';
    Long lng = 1000L;
    Object obj = 'test';
    Time t = Time.newInstance(12, 0, 0, 0);
    SObject sobj = new Account();

    // Collection types in incorrect cases
    List<String> strings = new List<String>{
      'a',
      'b'
    };
    Set<Integer> numbers = new Set<Integer>{
      1,
      2,
      3
    };
    Map<String, Integer> counts = new Map<String, Integer>{ 'a' => 1 };

    // Generics with primitives in incorrect cases
    List<String> listOfStrings = new List<String>{ 'test' };
    Set<Integer> setOfIntegers = new Set<Integer>{
      1,
      2
    };
    Map<String, Boolean> flags = new Map<String, Boolean>{ 'key' => true };

    // Nested collections with primitives
    List<List<String>> nestedLists = new List<List<String>>{
      new List<String>{
        'a',
        'b'
      }
    };
    Map<String, List<Integer>> mapWithLists = new Map<String, List<Integer>>{
      'key' => new List<Integer>{
        1,
        2,
        3
      }
    };
  }
}
