@Test
public class TestClass {
  @AuraEnabled
  public void auraMethod() {}
  @Future(Callout=true)
  public static void futureMethod() {}
}
