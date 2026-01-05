public class NestedTest {
  public void nestedStructures() {
    // Map with List values (nested lists should be multiline)
    Map<String, List<String>> mapWithLists = new Map<String, List<String>>{
      'tags' => new List<String>{
        'reading',
        'gaming'
      },
      'categories' => new List<String>{
        'tech',
        'books',
        'games'
      }
    };

    // Map with Set values
    Map<String, Set<String>> mapWithSets = new Map<String, Set<String>>{
      'group1' => new Set<String>{
        'a',
        'b'
      },
      'group2' => new Set<String>{
        'x',
        'y',
        'z'
      }
    };

    // Map with Map values (nested maps)
    Map<String, Map<String, String>> mapWithMaps =
      new Map<String, Map<String, String>>{
        'config' => new Map<String, String>{
          'key1' => 'value1',
          'key2' => 'value2'
        },
        'settings' => new Map<String, String>{ 'opt1' => 'val1' }
    };

    // List with Map values
    List<Map<String, String>> listWithMaps = new List<Map<String, String>>{
      new Map<String, String>{
        'a' => '1',
        'b' => '2'
      },
      new Map<String, String>{ 'c' => '3' }
    };

    // List with List values (nested lists)
    List<List<String>> listWithLists = new List<List<String>>{
      new List<String>{
        'a',
        'b'
      },
      new List<String>{
        'c',
        'd',
        'e'
      }
    };

    // Set with List values
    Set<List<String>> setWithLists = new Set<List<String>>{
      new List<String>{
        'one',
        'two'
      },
      new List<String>{ 'three' }
    };

    // Deeply nested: Map with Lists containing Maps
    Map<String, List<Map<String, String>>> deeplyNested =
      new Map<String, List<Map<String, String>>>{
        'items' => new List<Map<String, String>>{
          new Map<String, String>{
            'name' => 'item1',
            'id' => '1'
          },
          new Map<String, String>{ 'name' => 'item2' }
        }
      };
  }
}
