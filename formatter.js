const vscode = require('vscode');

/**
 * Djazair Code Formatter
 */
class DjazairFormatter {
  constructor() {
    this.indentSize = 4;
    this.useTabs = false;
  }

  /**
   * تنسيق الكود
   */
  format(code, options = {}) {
    if (options.tabSize) this.indentSize = options.tabSize;
    if (options.insertSpaces !== undefined) this.useTabs = !options.insertSpaces;

    const lines = code.split('\n');
    const formatted = [];
    let indentLevel = 0;
    let inMultilineString = false;
    let inMultilineComment = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const trimmed = line.trim();

      // تجاهل الأسطر داخل النصوص المتعددة
      if (inMultilineString) {
        formatted.push(line);
        if (trimmed.endsWith('"""')) {
          inMultilineString = false;
        }
        continue;
      }

      // تجاهل الأسطر داخل التعليقات المتعددة
      if (inMultilineComment) {
        formatted.push(line);
        if (trimmed.endsWith('*#')) {
          inMultilineComment = false;
        }
        continue;
      }

      // كشف بداية النصوص المتعددة
      if (trimmed.startsWith('"""')) {
        formatted.push(this.indent(indentLevel) + trimmed);
        if (!trimmed.endsWith('"""') || trimmed.length === 3) {
          inMultilineString = true;
        }
        continue;
      }

      // كشف بداية التعليقات المتعددة
      if (trimmed.startsWith('#*')) {
        formatted.push(this.indent(indentLevel) + trimmed);
        if (!trimmed.endsWith('*#')) {
          inMultilineComment = true;
        }
        continue;
      }

      // الأسطر الفارغة
      if (trimmed === '') {
        formatted.push('');
        continue;
      }

      // حساب التغيير في المسافة البادئة
      let currentIndent = indentLevel;

      // تقليل المسافة البادئة لـ end و elif و else و catch و finally
      const isEnd = this.isEnd(trimmed);
      const isElif = trimmed.startsWith('elif ');
      const isElse = trimmed === 'else:';
      const isCatch = trimmed.startsWith('catch ');
      const isFinally = trimmed === 'finally:';
      
      if (isEnd || isElif || isElse || isCatch || isFinally) {
        currentIndent = Math.max(0, indentLevel - 1);
        if (!isEnd) {
          indentLevel = currentIndent; // elif, else, catch, finally يبقون في نفس المستوى
        }
      }

      // معالجة الأقواس المعقوفة
      const startsWithCloseBrace = trimmed.startsWith('}');
      const endsWithOpenBrace = trimmed.endsWith('{');
      
      // إذا كان السطر يبدأ بـ }
      if (startsWithCloseBrace) {
        currentIndent = Math.max(0, currentIndent - 1);
      }

      // تنسيق السطر
      const formattedLine = this.formatLine(trimmed, currentIndent);
      formatted.push(formattedLine);

      // تحديث المستوى بعد طباعة السطر
      if (isEnd) {
        // end يُقلل المستوى للأسطر التالية
        indentLevel = Math.max(0, indentLevel - 1);
      } else if (this.isIncreaseIndent(trimmed)) {
        // الأسطر التي تنتهي بـ : تزيد المستوى
        indentLevel++;
      }

      // زيادة المسافة البادئة للأسطر التي تنتهي بـ {
      if (endsWithOpenBrace && !startsWithCloseBrace) {
        indentLevel++;
      }

      // تقليل المسافة البادئة بعد }
      if (startsWithCloseBrace) {
        indentLevel = Math.max(0, currentIndent);
      }
    }

    return formatted.join('\n');
  }

  /**
   * تنسيق سطر واحد
   */
  formatLine(line, level) {
    let formatted = line;

    // إزالة المسافات الزائدة
    formatted = formatted.replace(/\s+/g, ' ').trim();

    // تنسيق العمليات
    formatted = this.formatOperators(formatted);

    // تنسيق الفواصل
    formatted = this.formatCommas(formatted);

    // تنسيق الأقواس
    formatted = this.formatBrackets(formatted);

    // تنسيق النقطتين
    formatted = this.formatColons(formatted);

    // إضافة المسافة البادئة
    return this.indent(level) + formatted;
  }

  /**
   * تنسيق العمليات الحسابية والمنطقية
   */
  formatOperators(line) {
    let result = line;

    // حماية النصوص من التعديل
    const strings = [];
    result = result.replace(/"[^"]*"/g, (match) => {
      strings.push(match);
      return `__STRING_${strings.length - 1}__`;
    });

    // إضافة مسافات حول = (لكن ليس == أو != أو <= أو >=)
    result = result.replace(/([^=!<>*+\-/%&|^])\s*=\s*([^=])/g, '$1 = $2');
    
    // عمليات الإسناد المركبة
    result = result.replace(/\s*([\+\-\*\/%])\s*=/g, ' $1=');
    
    // إضافة مسافات حول العمليات الحسابية
    result = result.replace(/([^\s\+])\+([^\s\+=])/g, '$1 + $2');
    result = result.replace(/([^\s\-])-([^\s\-=])/g, '$1 - $2');
    result = result.replace(/([^\s\*])\*([^\s\*=])/g, '$1 * $2');
    result = result.replace(/([^\s\/])\/([^\s\/=])/g, '$1 / $2');
    result = result.replace(/([^\s%])%([^\s=])/g, '$1 % $2');

    // عمليات المقارنة
    result = result.replace(/([^\s<])<=([^\s])/g, '$1 <= $2');
    result = result.replace(/([^\s>])>=([^\s])/g, '$1 >= $2');
    result = result.replace(/([^\s=])==([^\s])/g, '$1 == $2');
    result = result.replace(/([^\s!])!=([^\s])/g, '$1 != $2');
    result = result.replace(/([^\s<])<([^\s=])/g, '$1 < $2');
    result = result.replace(/([^\s>])>([^\s=])/g, '$1 > $2');

    // إعادة النصوص
    strings.forEach((str, i) => {
      result = result.replace(`__STRING_${i}__`, str);
    });

    return result;
  }

  /**
   * تنسيق الفواصل
   */
  formatCommas(line) {
    // حماية النصوص من التعديل
    const strings = [];
    let result = line.replace(/"[^"]*"/g, (match) => {
      strings.push(match);
      return `__STRING_${strings.length - 1}__`;
    });

    // إضافة مسافة بعد الفاصلة
    result = result.replace(/,\s*/g, ', ');

    // إعادة النصوص
    strings.forEach((str, i) => {
      result = result.replace(`__STRING_${i}__`, str);
    });

    return result;
  }

  /**
   * تنسيق الأقواس
   */
  formatBrackets(line) {
    let result = line;

    // إزالة المسافات داخل الأقواس الفارغة
    result = result.replace(/\(\s+\)/g, '()');
    result = result.replace(/\[\s+\]/g, '[]');
    result = result.replace(/\{\s+\}/g, '{}');

    // مسافة قبل القوس في تعريف الدوال والشروط
    result = result.replace(/\b(fn|if|elif|while|for|catch)\s*\(/g, '$1 (');

    // إزالة المسافات الزائدة بعد (
    result = result.replace(/\(\s+/g, '(');
    
    // إزالة المسافات الزائدة قبل )
    result = result.replace(/\s+\)/g, ')');

    // إزالة المسافات بعد {
    result = result.replace(/\{\s+/g, '{');
    
    // إزالة المسافات قبل }
    result = result.replace(/\s+\}/g, '}');

    return result;
  }

  /**
   * تنسيق النقطتين
   */
  formatColons(line) {
    // التأكد من عدم وجود مسافة قبل : في نهاية السطر
    let result = line.replace(/\s*:\s*$/g, ':');
    
    // في حالة dictionary/object literals - مسافة بعد :
    result = result.replace(/"([^"]+)"\s*:\s*/g, '"$1": ');

    return result;
  }

  /**
   * إنشاء المسافة البادئة
   */
  indent(level) {
    if (this.useTabs) {
      return '\t'.repeat(level);
    }
    return ' '.repeat(level * this.indentSize);
  }

  /**
   * فحص إذا كان السطر هو end
   */
  isEnd(line) {
    return line === 'end' || line === 'end;';
  }

  /**
   * فحص إذا كان السطر يحتاج زيادة المسافة البادئة
   */
  isIncreaseIndent(line) {
    // السطر ينتهي بـ : ولا يحتوي على end
    if (!line.endsWith(':')) {
      return false;
    }
    
    // استثناء: إذا كان السطر كله هو "end:" فقط
    if (line.trim() === 'end:') {
      return false;
    }
    
    return true;
  }
}

/**
 * تفعيل الـ formatter
 */
function activate(context) {
  const formatter = new DjazairFormatter();

  const disposable = vscode.languages.registerDocumentFormattingEditProvider('djazair', {
    provideDocumentFormattingEdits(document, options) {
      const text = document.getText();
      const formatted = formatter.format(text, {
        tabSize: options.tabSize,
        insertSpaces: options.insertSpaces
      });

      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(text.length)
      );

      return [vscode.TextEdit.replace(fullRange, formatted)];
    }
  });

  // Range formatting (تنسيق جزء محدد)
  const rangeDisposable = vscode.languages.registerDocumentRangeFormattingEditProvider('djazair', {
    provideDocumentRangeFormattingEdits(document, range, options) {
      const text = document.getText(range);
      const formatted = formatter.format(text, {
        tabSize: options.tabSize,
        insertSpaces: options.insertSpaces
      });

      return [vscode.TextEdit.replace(range, formatted)];
    }
  });

  context.subscriptions.push(disposable, rangeDisposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  DjazairFormatter
};