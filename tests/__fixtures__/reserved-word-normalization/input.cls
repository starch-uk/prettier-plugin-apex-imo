Public Class MyClass {
	Private Static Final Integer count = 10;
	Protected Transient String name;
	Global Webservice Account account;

	Public Static Void myMethod() {
		If (count > 0) {
			Return;
		} Else {
			For (Integer i = 0; i < 10; i++) {
				While (i < 5) {
					Do {
						Break;
					} While (false);
				}
			}
		}
	}

	Public Void anotherMethod() {
		Integer x = 0;
		SomeClass obj = New SomeClass();
		This.someMethod();
		Super.someMethod();
	}

	Abstract Class InnerClass Implements SomeInterface {
		Virtual Void overrideMethod() {
		}
	}
}
