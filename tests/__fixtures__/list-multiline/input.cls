public class ListMultilineTest {
    public void multipleItems() {
        List<String> items = new List<String>{ 'one', 'two', 'three' };
        List<String> json = new List<String>{ '{', '  "name": "test"', '}' };
    }
}

