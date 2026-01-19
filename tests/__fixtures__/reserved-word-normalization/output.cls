public class MyClass {
  private static final Integer count = 10;
  protected transient String name;
  global webService Account account;

  public static Void myMethod() {
    if (count > 0) {
      return;
    } else {
      for (Integer i = 0; i < 10; i++) {
        while (i < 5) {
          do {
            break;
          } while (false);
        }
      }
    }
  }

  public Void anotherMethod() {
    Integer x = 0;
    SomeClass obj = new SomeClass();
    this.someMethod();
    super.someMethod();
  }

  abstract class InnerClass implements SomeInterface {
    virtual Void overrideMethod() {}
  }
}
