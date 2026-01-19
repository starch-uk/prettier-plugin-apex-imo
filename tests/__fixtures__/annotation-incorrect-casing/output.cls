public class TestClass {
  @AuraEnabled(
    Cacheable=true
    Continuation=false
  )
  public static void myMethod() {}
}
