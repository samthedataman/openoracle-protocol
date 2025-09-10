import { z } from 'zod';
import { AIError, AIValidationError } from '../types/ai';

export class JSONValidator {
  /**
   * Parse and validate JSON with strict error handling
   */
  static parseAndValidate<T>(
    content: string,
    schema: z.ZodSchema<T>,
    provider: string
  ): T {
    try {
      const parsed = this.parseJSON(content);
      return this.validateSchema(parsed, schema, provider);
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      throw new AIError(
        `JSON validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        provider as any,
        'VALIDATION_ERROR',
        error
      );
    }
  }

  /**
   * Parse JSON with multiple fallback strategies
   */
  static parseJSON(content: string): any {
    // Strategy 1: Direct parse
    const cleanContent = content.trim();
    
    try {
      return JSON.parse(cleanContent);
    } catch (directError) {
      // Strategy 2: Remove markdown code blocks
      let withoutCodeBlocks = cleanContent;
      if (withoutCodeBlocks.includes('```')) {
        withoutCodeBlocks = withoutCodeBlocks
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim();
        
        try {
          return JSON.parse(withoutCodeBlocks);
        } catch (codeBlockError) {
          // Continue to next strategy
        }
      }
      
      // Strategy 3: Extract JSON object with regex
      const jsonMatches = [
        /\{[\s\S]*\}/,  // Basic object match
        /\[[\s\S]*\]/,  // Array match
        /```json\s*(\{[\s\S]*?\})\s*```/gi, // Markdown JSON block
        /```\s*(\{[\s\S]*?\})\s*```/gi,     // Generic code block
      ];
      
      for (const regex of jsonMatches) {
        const match = cleanContent.match(regex);
        if (match) {
          try {
            const extracted = match[1] || match[0];
            return JSON.parse(extracted);
          } catch {
            continue;
          }
        }
      }
      
      // Strategy 4: Try to fix common JSON issues
      try {
        return this.attemptJSONRepair(cleanContent);
      } catch (repairError) {
        // Strategy 5: Extract key-value pairs manually
        try {
          return this.extractKeyValuePairs(cleanContent);
        } catch (extractError) {
          throw new Error(
            `All JSON parsing strategies failed. Original error: ${directError.message}`
          );
        }
      }
    }
  }

  /**
   * Attempt to repair common JSON issues
   */
  private static attemptJSONRepair(content: string): any {
    let repaired = content;
    
    // Fix trailing commas
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
    
    // Fix unquoted keys (basic case)
    repaired = repaired.replace(/(\w+):\s*/g, '"$1": ');
    
    // Fix single quotes to double quotes
    repaired = repaired.replace(/'/g, '"');
    
    // Fix escaped quotes issues
    repaired = repaired.replace(/\\"/g, '\\"');
    
    return JSON.parse(repaired);
  }

  /**
   * Extract key-value pairs when JSON is malformed
   */
  private static extractKeyValuePairs(content: string): any {
    const result: any = {};
    
    // Extract key-value patterns
    const patterns = [
      /"(\w+)":\s*"([^"]+)"/g,           // "key": "value"
      /"(\w+)":\s*(\d+\.?\d*)/g,         // "key": number
      /"(\w+)":\s*(true|false)/g,        // "key": boolean
      /"(\w+)":\s*\[([^\]]+)\]/g,        // "key": [array]
      /(\w+):\s*"([^"]+)"/g,             // key: "value" (unquoted key)
      /(\w+):\s*(\d+\.?\d*)/g,           // key: number (unquoted key)
      /(\w+):\s*(true|false)/g,          // key: boolean (unquoted key)
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const key = match[1];
        let value = match[2];
        
        // Parse value type
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (/^\d+\.?\d*$/.test(value)) value = parseFloat(value);
        else if (value.startsWith('[') && value.endsWith(']')) {
          try {
            value = JSON.parse(value);
          } catch {
            value = value.slice(1, -1).split(',').map(s => s.trim().replace(/"/g, ''));
          }
        }
        
        result[key] = value;
      }
    }
    
    if (Object.keys(result).length === 0) {
      throw new Error('Could not extract any key-value pairs');
    }
    
    return result;
  }

  /**
   * Validate data against Zod schema
   */
  static validateSchema<T>(
    data: any,
    schema: z.ZodSchema<T>,
    provider: string
  ): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AIValidationError(
          `Schema validation failed for provider ${provider}`,
          provider as any,
          error
        );
      }
      throw error;
    }
  }

  /**
   * Format validation errors for debugging
   */
  static formatValidationError(error: z.ZodError): string {
    const issues = error.issues.map(issue => {
      const path = issue.path.join('.');
      return `${path}: ${issue.message}`;
    });
    
    return `Validation failed:\n${issues.join('\n')}`;
  }

  /**
   * Attempt to fix common validation issues
   */
  static autoFixValidationIssues<T>(
    data: any,
    schema: z.ZodSchema<T>
  ): any {
    // Create a copy to avoid mutation
    const fixed = JSON.parse(JSON.stringify(data));
    
    try {
      // Try to infer fixes based on schema
      const schemaShape = (schema as any)._def;
      
      if (schemaShape?.shape) {
        // Handle ZodObject
        for (const [key, fieldSchema] of Object.entries(schemaShape.shape)) {
          this.autoFixField(fixed, key, fieldSchema as any);
        }
      }
      
      return fixed;
    } catch {
      return data; // Return original if fixing fails
    }
  }

  private static autoFixField(obj: any, key: string, schema: any): void {
    if (!obj.hasOwnProperty(key)) {
      // Add missing required fields with defaults
      const schemaType = schema._def?.typeName;
      
      switch (schemaType) {
        case 'ZodString':
          obj[key] = schema._def.defaultValue?.() || '';
          break;
        case 'ZodNumber':
          obj[key] = schema._def.defaultValue?.() || 0;
          break;
        case 'ZodBoolean':
          obj[key] = schema._def.defaultValue?.() || false;
          break;
        case 'ZodArray':
          obj[key] = schema._def.defaultValue?.() || [];
          break;
        case 'ZodObject':
          obj[key] = schema._def.defaultValue?.() || {};
          break;
      }
    } else {
      // Fix type mismatches
      const value = obj[key];
      const schemaType = schema._def?.typeName;
      
      if (schemaType === 'ZodNumber' && typeof value === 'string') {
        const num = parseFloat(value);
        if (!isNaN(num)) {
          obj[key] = num;
        }
      } else if (schemaType === 'ZodString' && typeof value === 'number') {
        obj[key] = String(value);
      } else if (schemaType === 'ZodBoolean' && typeof value === 'string') {
        obj[key] = value.toLowerCase() === 'true';
      }
    }
  }
}

/**
 * Utility function for quick JSON validation
 */
export const validateJSON = <T>(
  content: string,
  schema: z.ZodSchema<T>,
  provider: string = 'unknown'
): T => {
  return JSONValidator.parseAndValidate(content, schema, provider);
};

/**
 * Safe JSON parsing that won't throw
 */
export const safeParseJSON = (content: string): { success: true; data: any } | { success: false; error: Error } => {
  try {
    const data = JSONValidator.parseJSON(content);
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error('Unknown parsing error')
    };
  }
};