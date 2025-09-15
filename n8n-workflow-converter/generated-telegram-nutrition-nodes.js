/**
 * Generated Node Implementations for Telegram Nutrition Assistant Workflow
 * 
 * This file demonstrates how our configuration-aware n8n workflow converter
 * generates production-ready Node.js code that preserves all the exact
 * configurations, expressions, and business logic from the original workflow.
 */

// Base Node class for demonstration
class BaseNode {
    constructor(name, type) {
        this.name = name;
        this.type = type;
    }
    
    evaluateExpression(expression, inputData, context) {
        // Simplified expression evaluation for demo
        if (expression.includes('message.text')) {
            return inputData.json?.message?.text;
        }
        if (expression.includes('message.chat.id')) {
            return inputData.json?.message?.chat?.id;
        }
        if (expression.includes('message.voice.file_id')) {
            return inputData.json?.message?.voice?.file_id;
        }
        if (expression.includes('message.photo')) {
            const photos = inputData.json?.message?.photo || [];
            return photos[photos.length - 1]?.file_id; // Get highest quality
        }
        return expression;
    }
}

// =============================================================================
// TELEGRAM FILE DOWNLOAD NODE
// =============================================================================

class DownloadVoiceMessage extends BaseNode {
    constructor() {
        super('Download Voice Message', 'n8n-nodes-base.telegram');
        
        // Exact configuration from n8n workflow
        this.config = {
            fileId: "={{ $('Telegram Trigger').item.json.message.voice.file_id }}",
            resource: "file",
            additionalFields: {}
        };
        
        this.credentials = {
            telegramApi: {
                id: "yxDk2RnbewqwPdMO",
                name: "Pruebas"
            }
        };
    }
    
    async execute(inputData, context) {
        // Resolve the dynamic file ID expression
        const fileId = this.evaluateExpression(
            this.config.fileId, 
            inputData, 
            context
        );
        
        // Simulate Telegram Bot download for demo
        console.log(`📥 Downloading voice file: ${fileId}`);
        
        // Return simulated binary data
        return [{
            json: { fileId, downloaded: true },
            binary: {
                data: {
                    data: Buffer.from('simulated voice data'),
                    mimeType: 'audio/ogg',
                    fileName: `voice_${fileId}.ogg`
                }
            }
        }];
    }
}

// =============================================================================
// TELEGRAM IMAGE DOWNLOAD NODE
// =============================================================================

class DownloadImage extends BaseNode {
    constructor() {
        super('Download IMAGE', 'n8n-nodes-base.telegram');
        
        // Complex expression for selecting best quality photo
        this.config = {
            fileId: "={{ $('Telegram Trigger').item.json.message.photo[3]?.file_id || $('Telegram Trigger').item.json.message.photo[2]?.file_id || $('Telegram Trigger').item.json.message.photo[1]?.file_id }}",
            resource: "file",
            additionalFields: {}
        };
        
        this.credentials = {
            telegramApi: {
                id: "yxDk2RnbewqwPdMO",
                name: "Pruebas"
            }
        };
    }
    
    async execute(inputData, context) {
        // Resolve complex photo selection expression
        const fileId = this.evaluateExpression(
            this.config.fileId, 
            inputData, 
            context
        );
        
        if (!fileId) {
            throw new Error('No suitable photo found in message');
        }
        
        // Simulate Telegram Bot download for demo
        console.log(`📥 Downloading image file: ${fileId}`);
        
        // Return simulated binary data
        return [{
            json: { fileId, downloaded: true },
            binary: {
                data: {
                    data: Buffer.from('simulated image data'),
                    mimeType: 'image/jpeg',
                    fileName: `photo_${fileId}.jpg`
                }
            }
        }];
    }
}

// =============================================================================
// GOOGLE GEMINI IMAGE ANALYSIS NODE
// =============================================================================

class AnalyzeImage extends BaseNode {
    constructor() {
        super('Analyze image', '@n8n/n8n-nodes-langchain.googleGemini');
        
        // Comprehensive nutrition analysis prompt
        this.config = {
            text: `You are a Nutrition Vision Assistant. Think like a food scientist and registered dietitian. Reason silently and do not reveal your steps. From a single food photo, identify the meal components, estimate portion weight in grams per component using geometric/visual cues, then compute total calories, protein, carbs, and fat.

Estimation method (internal only; do not output these steps)

Identify components: list the main foods (e.g., chicken breast, white rice, mixed salad, sauce).

Choose references: map each component to a standard reference food.

Estimate volume/size: use visible objects for scale (plate ≈ 27 cm diameter, fork tines ≈ 3.5 cm, spoon bowl ≈ 5–6 cm). Approximate shapes (cuboid, cylinder, dome) to get volume in ml (≈ cm³).

Convert to grams (densities, g/ml): meats 1.05; cooked rice 0.66; cooked pasta 0.60; potato/solid starchy veg 0.80; leafy salad 0.15; sauces creamy 1.00; oils 0.91. If the image clearly suggests deep-fried or glossy/oily coating, account for added oil.

Macros & energy per 100 g (reference values):

White rice, cooked: 130 kcal, P 2.7, C 28, F 0.3
Pasta, cooked: 131 kcal, P 5.0, C 25, F 1.1
Chicken breast, cooked skinless: 165 kcal, P 31, C 0, F 3.6
Salmon, cooked: 208 kcal, P 20, C 0, F 13
Lean ground beef (≈10% fat), cooked: 217 kcal, P 26, C 0, F 12
Black beans, cooked: 132 kcal, P 8.9, C 23.7, F 0.5
Potato, baked: 93 kcal, P 2.5, C 21, F 0.1
Lettuce/leafy salad: 15 kcal, P 1.4, C 2.9, F 0.2
Avocado: 160 kcal, P 2, C 9, F 15
Bread (white): 265 kcal, P 9, C 49, F 3.2
Egg, cooked: 155 kcal, P 13, C 1.1, F 11
Cheddar cheese: 403 kcal, P 25, C 1.3, F 33
Olive oil: 884 kcal, P 0, C 0, F 100

Output rules (must follow exactly)

Plain text only.
Use this exact structure and field order.
Values are numbers only (no units, no "g" or "kcal"), no extra text, no JSON, no notes.

Meal Description: [short description]
Calories: [number]
Proteins: [number]
Carbs: [number]
Fat: [number]`,
            
            modelId: {
                __rl: true,
                mode: "list",
                value: "models/gemini-2.5-pro",
                cachedResultName: "models/gemini-2.5-pro"
            },
            options: {},
            resource: "image",
            inputType: "binary",
            operation: "analyze"
        };
        
        this.credentials = {
            googlePalmApi: {
                id: "IrGmkWole0gsi1H8",
                name: "Google Gemini(PaLM) Api account"
            }
        };
    }
    
    async execute(inputData, context) {
        // Simulate Google Gemini analysis for demo
        console.log('🤖 Analyzing image with Google Gemini...');
        console.log(`📝 Using ${this.config.text.length}-character nutrition prompt`);
        
        // Simulate AI analysis result
        const simulatedAnalysis = `Meal Description: Grilled chicken breast with quinoa and mixed vegetables
Calories: 450
Proteins: 35
Carbs: 40
Fat: 12`;
        
        // Parse structured nutrition data
        const nutritionData = this.parseNutritionAnalysis(simulatedAnalysis);
        
        return [{
            json: {
                analysis: simulatedAnalysis,
                ...nutritionData
            }
        }];
    }
    
    parseNutritionAnalysis(text) {
        const lines = text.split('\n');
        const data = {};
        
        for (const line of lines) {
            if (line.startsWith('Meal Description:')) {
                data.mealDescription = line.replace('Meal Description:', '').trim();
            } else if (line.startsWith('Calories:')) {
                data.calories = parseInt(line.replace('Calories:', '').trim());
            } else if (line.startsWith('Proteins:')) {
                data.proteins = parseInt(line.replace('Proteins:', '').trim());
            } else if (line.startsWith('Carbs:')) {
                data.carbs = parseInt(line.replace('Carbs:', '').trim());
            } else if (line.startsWith('Fat:')) {
                data.fat = parseInt(line.replace('Fat:', '').trim());
            }
        }
        
        return data;
    }
}

// =============================================================================
// SWITCH NODE FOR MESSAGE ROUTING
// =============================================================================

class InputMessageRouter extends BaseNode {
    constructor() {
        super('Input Message Router1', 'n8n-nodes-base.switch');
        
        // Complex routing rules with multiple conditions
        this.config = {
            rules: {
                values: [
                    {
                        outputKey: "Text",
                        conditions: {
                            options: {
                                version: 2,
                                leftValue: "",
                                caseSensitive: true,
                                typeValidation: "strict"
                            },
                            combinator: "and",
                            conditions: [{
                                id: "fcb767ee-565e-4b56-a54e-6f97f739fc24",
                                operator: {
                                    type: "string",
                                    operation: "exists",
                                    singleValue: true
                                },
                                leftValue: "={{ $('Telegram Trigger').item.json.message.text }}",
                                rightValue: ""
                            }]
                        },
                        renameOutput: true
                    },
                    {
                        outputKey: "Voice Message",
                        conditions: {
                            options: {
                                version: 2,
                                leftValue: "",
                                caseSensitive: true,
                                typeValidation: "strict"
                            },
                            combinator: "and",
                            conditions: [{
                                id: "c1016c40-f8f2-4e08-8ec8-5cdb88f5c87a",
                                operator: {
                                    type: "object",
                                    operation: "exists",
                                    singleValue: true
                                },
                                leftValue: "={{ $('Telegram Trigger').item.json.message.voice }}",
                                rightValue: ""
                            }]
                        },
                        renameOutput: true
                    },
                    {
                        outputKey: "Image",
                        conditions: {
                            options: {
                                version: 2,
                                leftValue: "",
                                caseSensitive: true,
                                typeValidation: "strict"
                            },
                            combinator: "and",
                            conditions: [{
                                id: "f8150ac7-eea4-4658-8da9-f7a1c88a471d",
                                operator: {
                                    type: "string",
                                    operation: "exists",
                                    singleValue: true
                                },
                                leftValue: "={{ $('Telegram Trigger').item.json.message.photo[0].file_id }}",
                                rightValue: ""
                            }]
                        },
                        renameOutput: true
                    }
                ]
            },
            options: {
                ignoreCase: false,
                fallbackOutput: "extra",
                allMatchingOutputs: true
            }
        };
    }
    
    async execute(inputData, context) {
        const results = {
            Text: [],
            "Voice Message": [],
            Image: [],
            extra: []
        };
        
        for (const item of inputData) {
            let matched = false;
            
            // Evaluate each rule
            for (const rule of this.config.rules.values) {
                if (this.evaluateConditions(rule.conditions, item, context)) {
                    results[rule.outputKey].push(item);
                    matched = true;
                    
                    if (!this.config.options.allMatchingOutputs) {
                        break;
                    }
                }
            }
            
            // Fallback output
            if (!matched && this.config.options.fallbackOutput) {
                results[this.config.options.fallbackOutput].push(item);
            }
        }
        
        return results;
    }
    
    evaluateConditions(conditionsConfig, item, context) {
        const conditions = conditionsConfig.conditions || [];
        const combinator = conditionsConfig.combinator || 'and';
        
        const results = conditions.map(condition => {
            const leftValue = this.evaluateExpression(condition.leftValue, item, context);
            return this.evaluateOperator(condition.operator, leftValue, condition.rightValue);
        });
        
        if (combinator === 'and') {
            return results.every(result => result);
        } else if (combinator === 'or') {
            return results.some(result => result);
        }
        
        return false;
    }
    
    evaluateOperator(operator, leftValue, rightValue) {
        switch (operator.operation) {
            case 'exists':
                return leftValue !== undefined && leftValue !== null && leftValue !== '';
            case 'equals':
                return leftValue === rightValue;
            case 'notEquals':
                return leftValue !== rightValue;
            default:
                return false;
        }
    }
    
    evaluateExpression(expression, inputData, context) {
        // Enhanced expression evaluation for routing
        if (expression.includes('message.text')) {
            return inputData.json?.message?.text;
        }
        if (expression.includes('message.voice')) {
            return inputData.json?.message?.voice;
        }
        if (expression.includes('message.photo[0].file_id')) {
            return inputData.json?.message?.photo?.[0]?.file_id;
        }
        return super.evaluateExpression(expression, inputData, context);
    }
}

// =============================================================================
// SET NODE FOR DATA TRANSFORMATION
// =============================================================================

class GetMessageText extends BaseNode {
    constructor() {
        super('get_message (text)', 'n8n-nodes-base.set');
        
        this.config = {
            options: {},
            assignments: {
                assignments: [
                    {
                        id: "801ec600-22ad-4a94-a2b4-ae72eb271df0",
                        name: "message",
                        type: "string",
                        value: "={{ $('Telegram Trigger').item.json.message.text }}"
                    },
                    {
                        id: "263071fb-bcdf-42b0-bb46-71b75fa0bf2a",
                        name: "chat_id",
                        type: "string",
                        value: "={{ $('Telegram Trigger').item.json.message.chat.id }}"
                    }
                ]
            }
        };
    }
    
    async execute(inputData, context) {
        const results = [];
        
        for (const item of inputData) {
            const newItem = { ...item };
            newItem.json = { ...item.json };
            
            // Apply each assignment
            for (const assignment of this.config.assignments.assignments) {
                const value = this.evaluateExpression(assignment.value, item, context);
                newItem.json[assignment.name] = this.convertType(value, assignment.type);
            }
            
            results.push(newItem);
        }
        
        return results;
    }
    
    convertType(value, type) {
        switch (type) {
            case 'string':
                return String(value);
            case 'number':
                return Number(value);
            case 'boolean':
                return Boolean(value);
            default:
                return value;
        }
    }
}

module.exports = {
    DownloadVoiceMessage,
    DownloadImage,
    AnalyzeImage,
    InputMessageRouter,
    GetMessageText
};