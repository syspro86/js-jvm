import { JVMObjectRef, JVM } from './JVM';
import { ClassLoader } from "./ClassLoader";
import { Class, ClassMethod, ClassField, AccessFlagsType } from "./Class";

let baseClasses = {
    'java/lang/Object': {
        '<init>()V': function() {

        }
    },
    'java/lang/Iterable': {
        '<init>()V': function() {

        },
        'iterator()Ljava/util/Iterator;': function(self_id: number) {
            return 0
        }
    },
    'java/lang/System': {
        'static <clinit>()V': async function() {
            var self: Class = this

            self.fields['out'] = new ClassField()
            self.fields['out'].static_value = JVM.active.alloc_instance('java/io/PrintStream')
            
            // new JVMObjectRef('java/io/PrintStream')
        },
    },
    'java/io/PrintStream': {
        'println(J)V': function(self_id: number, value1: number, value2: number) {
            var self: JVMObjectRef = JVM.active.heap[self_id]
            console.log((value1 << 32) + value2)
        }
    }
}

export class BootClassLoader extends ClassLoader {
    constructor() {
        super()
    }

    public async loadClassImpl(className: string): Promise<{clazz: Class, cached: boolean}> {
        var clazz: Class = null
        if (className in baseClasses) {
            clazz = new Class()
            clazz.class_name = className
            var methods = baseClasses[className]
            for (var name in methods) {
                var method = methods[name]
                var modifiers = name.split(" ")
                var signature = modifiers[modifiers.length - 1]
                modifiers.splice(modifiers.length - 1, 1)

                clazz.methods[signature] = new ClassMethod()
                clazz.methods[signature].signature = signature
                clazz.methods[signature].code_native = method
                clazz.methods[signature].access_flags = new AccessFlagsType()
                for (let mod of modifiers) {
                    if (mod == "static") {
                        clazz.methods[signature].access_flags.acc_static = true
                    }
                }

                var str = signature.substring(signature.indexOf('(')).replace(/\(|\).+$/g, '').replace(/\[/g, '').replace(/L[a-zA-Z0-9/$]+;/g, 'V')
                clazz.methods[signature].args_size = str.length + str.replace(/[^JD]/g, '').length
                if (!clazz.methods[signature].access_flags.acc_static) {
                    clazz.methods[signature].args_size++
                }
            }
        }
        return {
            clazz: clazz,
            cached: false
        }
    }
}
