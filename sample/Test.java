public class Test {

    static class A implements Iterable<String> {
        @Override
        public java.util.Iterator<String> iterator() {return null;}
    }

    protected static double add(int a, long b) {
        return a + b;
    }

    public static void main(String[] args) {
        System.out.println("Hello, world!");

        if (add(10, 20L) == 30D) {
            System.out.println(30f);
        }

        Iterable<String> i = new Test.A();
        i.iterator();
    }
}
