import { Class, ClassFile, ConstantPoolTagNames, ClassMethod } from "./Class"
import { ClassReader } from "./ClassReader"
import * as fs from "fs";
import * as path from "path"

export class ClassLoader {
    private loadedClasses: { [index: string]: Class } = {};
    private classpath: string[] = ['sample'];

    constructor() {
    }

    public loadClass(className: string): {clazz: Class, cached: boolean} {
        if (className in this.loadedClasses) {
            return { clazz: this.loadedClasses[className], cached: true }
        } else {
            var filepath = className.replace(/\./g, '/') + '.class'

            for (let classpath of this.classpath) {
                var stat: fs.Stats = fs.statSync(classpath)
                if (stat.isDirectory()) {
                    var classfile = path.join(classpath, filepath)
                    if (fs.existsSync(classfile)) {
                        return { clazz: this.loadClassFile(classfile), cached: false }
                    }
                }
            }
            return { clazz: null, cached: false }
        }
    }

    public loadClassFile(bufferOrPath: Buffer | string): Class {
        var buffer: Buffer
        if (bufferOrPath instanceof Buffer) {
            buffer = bufferOrPath
        } else if (typeof bufferOrPath === "string") {
            buffer = fs.readFileSync(bufferOrPath)            
        }

        var reader: ClassReader
        reader = new ClassReader(buffer)

        var classFile: ClassFile = reader.read()
        this.javap(classFile)

        var clazz: Class = new Class()
        clazz.class_name = classFile.this_class_name
        clazz.constant_pool = classFile.constant_pool
        classFile.method_info.forEach(method => {
            var method_name = method.name + method.descriptor
            var cm = new ClassMethod()
            method.attributes.forEach(attr => {
                if (attr.attribute_name == 'Code') {
                    cm.code = attr.code_info.code
                    cm.max_locals = attr.code_info.max_locals
                    cm.max_stack = attr.code_info.max_stack
                    cm.exception_table = attr.code_info.exception_table
                    cm.args_size = method.descriptor.replace(/\(|\).+$/g, '').replace(/\[/g, '').replace(/L[a-zA-Z0-9/$]+;/g, 'V').length
                }
            })
            clazz.methods[method_name] = cm
        })
        
        return clazz
    }

    private javap(clazz: ClassFile): void {
        console.log('this class ' + clazz.this_class_name)

        function leftPad(str: string, len: number): string {
            while (str.length < len) {
                str = ' ' + str
            }
            return str
        }

        function rightPad(str: string, len: number): string {
            while (str.length < len) {
                str = str + ' '
            }
            return str
        }

        function fromClass(index: number): string {
            var index1 = clazz.constant_pool[index].name_index
            return clazz.constant_pool[index1].utf_val
        }

        function fromNameAndType(index: number): string {
            var index1 = clazz.constant_pool[index].name_index
            var index2 = clazz.constant_pool[index].descriptor_index
            return clazz.constant_pool[index1].utf_val + ':'
                 + clazz.constant_pool[index2].utf_val
        }
        
        function fromMemberRef(index: number): string {
            var index1 = clazz.constant_pool[index].class_index
            var index2 = clazz.constant_pool[index].name_and_type_index
            return fromClass(index1) + '.' + fromNameAndType(index2)
        }

        console.log('Constant pool:')
        for (var i = 1; i < clazz.constant_pool.length; i++) {
            if (clazz.constant_pool[i] == null) {
                continue
            }

            var tag = clazz.constant_pool[i].tag
            var text = leftPad('#' + i, 5) + ' = '
            var index1: number, index2: number
            
            text += rightPad(ConstantPoolTagNames[tag], 19)

            switch (tag) {
                case 1: // Utf8
                    text += clazz.constant_pool[i].utf_val
                    break
                
                case 3: // Int
                    text += clazz.constant_pool[i].int_val
                    break

                case 4: // Float
                    text += clazz.constant_pool[i].float_val + 'f'
                    break

                case 5: // Long
                    text += clazz.constant_pool[i].long_val + 'l'
                    break

                case 6: // Double
                    text += clazz.constant_pool[i].double_val + 'd'
                    break

                case 7: // Class
                    text += '#' + clazz.constant_pool[i].name_index + '\t\t//  ' + fromClass(i)
                    break

                case 8: // String
                    index1 = clazz.constant_pool[i].string_index
                    text += '#' + index1 + '\t\t//  ' + clazz.constant_pool[index1].utf_val
                    break

                case 9: // field ref
                case 10: // method ref
                case 11: // interface method ref
                    index1 = clazz.constant_pool[i].class_index
                    index2 = clazz.constant_pool[i].name_and_type_index
                    text += '#' + index1 + '.#' + index2 + '\t\t//  ' + fromMemberRef(i)
                    break

                case 12: // name and type
                    index1 = clazz.constant_pool[i].name_index
                    index2 = clazz.constant_pool[i].descriptor_index
                    text += '#' + index1 + ':#' + index2 + '\t\t//  ' + fromNameAndType(i)
                    break
            
            }
            console.log(text)
        }
        return null
    }
}
