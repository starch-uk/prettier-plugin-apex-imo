public class TestClass {
  @RestResource(
    UrlMapping='/services/apexrest/MyVeryLongServiceNameThatExceedsPrintWidth'
  )
  public class MyService {}
}
