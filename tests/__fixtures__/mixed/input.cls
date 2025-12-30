public class MixedTest {
    public void mixedScenarios() {
        // Single item list - should stay inline
        List<String> single = new List<String>{ 'only' };

        // Multiple item list - should be multiline
        List<String> multiple = new List<String>{ 'one', 'two' };

        // Single pair map - should stay inline
        Map<String, String> singleMap = new Map<String, String>{ 'key' => 'value' };

        // Multiple pair map - should be multiline
        Map<String, String> multiMap = new Map<String, String>{ 'a' => '1', 'b' => '2' };

        // Nested structures
        Map<String, List<String> > nested = new Map<String, List<String> >{
            'tags' => new List<String>{ 'one', 'two' },
            'categories' => new List<String>{ 'a', 'b', 'c' }
        };
    }
}

