import { Class, ClassFile, ConstantPoolTagNames, ClassMethod, ClassField } from "./Class"
import { ClassReader } from "./ClassReader"
import * as JSZip from "jszip"
import * as fs from "fs";
import * as path from "path"

export class ClassLoader {
    static loadedClasses: { [index: string]: Class } = {};

    public async loadClass(className: string): Promise<{clazz: Class, cached: boolean}> {
        className = className.replace(/\./g, '/')
        if (className in ClassLoader.loadedClasses) {
            return { clazz: ClassLoader.loadedClasses[className], cached: true }
        } else {
            var clazz = await this.loadClassImpl(className)
            if (clazz.clazz != null) {
                this.registerClass(className, clazz.clazz)
            }
            return clazz
        }
    }

    public async loadClassImpl(className: string): Promise<{clazz: Class, cached: boolean}> {
        return {
            clazz: null,
            cached: false
        }
    }

    private registerClass(className: string, clazz: Class): void {
        ClassLoader.loadedClasses[className] = clazz
    }
}

export class CompositeClassLoader extends ClassLoader {
    constructor(private classLoaders: ClassLoader[]) {
        super()
    }

    public add(classLoader: ClassLoader): void {
        this.classLoaders.push(classLoader)
    }

    public async loadClassImpl(className: string): Promise<{clazz: Class, cached: boolean}> {
        for (let classLoader of this.classLoaders) {
            var ret = await classLoader.loadClassImpl(className)
            if (ret.clazz != null) {
                return ret
            }
        }
        return {
            clazz: null,
            cached: false
        }
    }
}

export class DefaultClassLoader extends ClassLoader {
    constructor(private classpath: string[]) {
        super()
    }

    public async loadClassImpl(className: string): Promise<{clazz: Class, cached: boolean}> {
        var filepath = className + '.class'

        for (let classpath of this.classpath) {
            if (!fs.existsSync(classpath)) {
                continue
            }
            var stat: fs.Stats = fs.statSync(classpath)
            if (stat.isDirectory()) {
                var classfile = path.join(classpath, filepath)
                if (fs.existsSync(classfile)) {
                    var clazz = this.loadClassFile(classfile)
                    return { clazz: clazz, cached: false }
                }
            } else if (stat.isFile()) {
                if (classpath.endsWith('.jar')) {
                    buffer = fs.readFileSync(classpath)
                    var jszip = await JSZip.loadAsync(buffer)
                    var jszobj = jszip.file(filepath)
                    if (jszobj == null) {
                        continue
                    }
                    var buffer = await jszobj.async('nodebuffer')
                    var clazz = this.loadClassFile(buffer)
                    return { clazz: clazz, cached: false }
                }
            }
        }
        return { clazz: null, cached: false }
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

        var clazz: Class = new Class()
        clazz.class_name = classFile.this_class_name
        clazz.constant_pool = classFile.constant_pool
        classFile.methods.forEach(method => {
            var method_name = method.name + method.descriptor
            var cm = new ClassMethod()
            cm.signature = method_name
            cm.access_flags = method.access_flags
            method.attributes.forEach(attr => {
                if (attr.attribute_name == 'Code') {
                    cm.code = attr.code_info.code
                    cm.max_locals = attr.code_info.max_locals
                    cm.max_stack = attr.code_info.max_stack
                    cm.exception_table = attr.code_info.exception_table
                    var str = method.descriptor.replace(/\(|\).+$/g, '').replace(/\[/g, '').replace(/L[a-zA-Z0-9/$]+;/g, 'V')
                    cm.args_size = str.length + str.replace(/[^JD]/g, '').length
                    if (!method.access_flags.acc_static) {
                        cm.args_size++
                    }
                }
            })
            clazz.methods[method_name] = cm
        })
        classFile.fields.forEach(field => {
            var field_name = field.name
            var cf = new ClassField()
            field.attributes.forEach(attr => {

            })
            clazz.fields[field_name] = cf
        })
        
        return clazz
    }

    public javap(clazz: Class): void {
        console.log('this class ' + clazz.class_name)

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
