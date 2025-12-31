public class TestClass {
  @RestResource(
    urlMapping='/services/apexrest/MyVeryLongServiceNameThatExceedsPrintWidth'
  )
  public class MyService {
  }
}
