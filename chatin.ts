import '@abraham/reflection';
import {
  ChatCompletionFunctions,
  ChatCompletionRequestMessage,
  CreateCompletionResponseUsage,
  OpenAIApi,
} from 'openai';
import {isWithinTokenLimit} from 'gpt-tokenizer';

/**
 * Decorator for a chat function.
 *
 * @param data.name         Name of the function passsed to GPT.
 * @param data.description  Description of the function passed to GPT.
 */
export function ChatFunction(data: {name: string; description: string}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor?: PropertyDescriptor
  ): void {
    Reflect.defineMetadata('chat_function', data, target, propertyKey);
  };
}

/**
 * Decorator for a chat function paramter.
 *
 * @param   data.description  Description of the parameter passed to GPT.
 * @param   data.type         Type of the parameter passed to GPT, either "string" or "object".
 * @param   data.required     Whether the parameter is required or not.
 */
export function ChatParameter(data: {
  description: string;
  type: 'string' | 'object';
  required?: boolean;
}) {
  return function (
    target: any,
    propertyKey: string,
    parameterIndex: number
  ): void {
    Reflect.defineMetadata(
      `chat_function_${parameterIndex}`,
      {...data, name: propertyKey},
      target,
      propertyKey
    );
  };
}

/** Options for retrieving a function message */
export interface GetFunctionMessageOptions {
  /** The maximum number of tokens to request. */
  requestMaxTokens: number;
}

/** Options for getting message completions. */
export interface GetCompletionOptions {
  // The model to use.
  model: string;
  // Whether to automatically call functions until a non-function response is returned.
  callFunctions: boolean;
}

/** Options for the chat functions controller. */
export interface ChatFunctionsControllerOptions {
  model: string;
}

/** Data stored for each chat function */
export interface ChatFunctionData {
  // The description of the function
  description: string;
  // Data for each parameter
  parameterData: any[];
  // Names of required parameters
  parameterRequired: string[];
  // Map of parameter names to parameter indices
  parameterIndex: Map<string, number>;
  // The function itself
  func: (...args: any[]) => any;
}

/** Options for registering functions */
interface RegisterFunctionsOptions {
  // The namespace to use for the functions
  namespace?: string;
  // The functions to enable
  enable: string[];
}

/** Controller for chat functions */
export class ChatFunctionsController {
  registeredFunctionsMap = new Map<string, ChatFunctionData>();
  enabledFunctions: string[] = [];

  usage: CreateCompletionResponseUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };

  messages: Array<ChatCompletionRequestMessage> = [];
  options: ChatFunctionsControllerOptions;

  /** Constructor.
   * @param openai The OpenAI API.
   * @param options Options for the controller.
   */
  constructor(
    public openai: OpenAIApi,
    options?: Partial<ChatFunctionsControllerOptions>
  ) {
    this.options = {
      model: 'gpt-3.5-turbo-0613',
      ...options,
    };
  }

  /** Register a new plugin with function decorators.
   * @param plugin The plugin to register.
   * @param options Options for registering the plugin.
   */
  registerFunctions(plugin: any, options?: Partial<RegisterFunctionsOptions>) {
    const opts: RegisterFunctionsOptions = {
      enable: [],
      ...options,
    };
    for (const toEnable of opts.enable) {
      this.enabledFunctions.push(
        opts.namespace ? `${opts.namespace}.${toEnable}` : toEnable
      );
    }

    Object.getOwnPropertyNames(Object.getPrototypeOf(plugin))
      .filter(name => Reflect.hasMetadata('chat_function', plugin, name))
      .forEach(name => {
        const metadata = Reflect.getMetadata('chat_function', plugin, name) as {
          name: string;
          description: string;
        };
        const parameterData = [];
        const parameterRequired = [];
        const parameterIndex = new Map<string, number>();
        let i = 0;
        const namespaced = opts.namespace
          ? `${opts.namespace}.${metadata.name}`
          : metadata.name;
        while (Reflect.hasMetadata(`chat_function_${i}`, plugin, name)) {
          const metadata = Reflect.getMetadata(
            `chat_function_${i}`,
            plugin,
            name
          ) as {
            name: string;
            description: string;
            type: 'string' | 'object';
            required?: boolean;
          };
          parameterData.push(metadata);
          if (metadata.required) {
            parameterRequired.push(metadata.name);
          }
          parameterIndex.set(metadata.name, i);
          i++;
        }
        this.registeredFunctionsMap.set(namespaced, {
          description: metadata.description,
          parameterRequired,
          parameterData,
          parameterIndex,
          func: plugin[name].bind(plugin),
        });
      });
  }

  /** Get registered functions.
   * @returns An array of registered functions.
   */
  getRegisteredFunctions(): ChatCompletionFunctions[] {
    return Array.from(this.registeredFunctionsMap, ([name, data]) => {
      return {
        name,
        description: data.description,
        parameters: {
          type: 'object',
          properties: {
            ...data.parameterData.reduce((acc, cur) => {
              acc[cur.name] = {type: cur.type, description: cur.description};
              return acc;
            }, {} as any),
          },
        },
        required: data.parameterData.filter(p => p.required).map(p => p.name),
      };
    }).filter(f => this.enabledFunctions.includes(f.name));
  }

  /** Handle a request for a function.
   * @param name The name of the function.
   * @param args The arguments to the function.
   *
   * @returns The response from the function.
   */
  async handleFunctionCall(name: string, args: string): Promise<string> {
    const funcData = this.registeredFunctionsMap.get(name);
    if (!funcData) {
      throw new Error(`Function ${name} not found`);
    } else {
      const parsedArgs = JSON.parse(args);

      const argsArray = [];

      if (
        !funcData.parameterRequired.every(r =>
          Object.getOwnPropertyNames(parsedArgs).includes(r)
        )
      ) {
        throw new Error(
          `Missing required parameters (needed "${funcData.parameterRequired.join(
            ', '
          )}", got ${Object.getOwnPropertyNames(parsedArgs).join(', ')})`
        );
      }

      for (const [key, value] of Object.entries(parsedArgs)) {
        const position = funcData.parameterIndex.get(key);
        if (position === undefined) {
          throw new Error(`Unknown parameter ${key}`);
        }
        argsArray[position] = value;
      }

      return await funcData.func(...argsArray);
    }
  }

  /** Enable a function by name.
   * @param name The name of the function to enable.
   */
  enableFunction(name: string) {
    if (this.enabledFunctions.indexOf(name) != -1) {
      this.enabledFunctions.push(name);
    }
  }

  /** Disable a function by name.
   * @param name The name of the function to disable.
   */
  disableFunction(name: string) {
    const index = this.enabledFunctions.indexOf(name);
    if (index != -1) {
      this.enabledFunctions.splice(index, 1);
    }
  }

  /** Enable multiple functions by name.
   * @param names The names of the functions to enable.
   * @see enableFunction
   */
  enableFunctions(...names: string[]) {
    for (const name of names) {
      this.enableFunction(name);
    }
  }

  /** Disable multiple functions by name.
   * @param names The names of the functions to disable.
   * @see disableFunction
   */
  disableFunctions(...names: string[]) {
    for (const name of names) {
      this.disableFunction(name);
    }
  }

  defaultFunctionMessageOptions: GetFunctionMessageOptions = {
    requestMaxTokens: 2048,
  };

  /** Get a function message from a message.
   * @param message The message to get the function message from.
   * @param options Options for getting the function message.
   *
   * @returns The function message.
   */
  async getFunctionMessageFromMessage(
    message: ChatCompletionRequestMessage,
    options?: Partial<GetFunctionMessageOptions>
  ): Promise<ChatCompletionRequestMessage> {
    if (!message.function_call) {
      throw new Error('Message does not have a function call');
    }

    return this.getFunctionMessage(
      message.function_call.name!,
      message.function_call.arguments!,
      options
    );
  }

  /** Get a function message from a function name and arguments.
   * @param name The name of the function.
   * @param args The arguments to the function.
   * @param options Options for getting the function message.
   *
   * @returns The function message.
   */
  async getFunctionMessage(
    name: string,
    args: string,
    options?: Partial<GetFunctionMessageOptions>
  ): Promise<ChatCompletionRequestMessage> {
    const opts = {...this.defaultFunctionMessageOptions, ...options};

    try {
      const result = await this.handleFunctionCall(name, args);
      let truncatedResult = result;
      while (!isWithinTokenLimit(truncatedResult, opts.requestMaxTokens)) {
        if (truncatedResult.length > 4 * opts.requestMaxTokens) {
          truncatedResult = truncatedResult.substring(
            0,
            4 * opts.requestMaxTokens
          );
        } else {
          truncatedResult = truncatedResult.substring(
            0,
            truncatedResult.length - 4
          );
        }
      }

      return {
        role: 'function',
        name: name,
        content: truncatedResult,
      };
    } catch (e) {
      return {
        role: 'function',
        name,
        content: JSON.stringify({error: (e as Error).message}),
      };
    }
  }

  /** Get a completion with a message.
   * @param message The message to get the completion with.
   * @param options Options for getting the completion.
   */
  async getCompletionWithMessage(
    message: ChatCompletionRequestMessage,
    options?: Partial<GetCompletionOptions>
  ) {
    this.addMessage(message);
    return this.getNextCompletion(options);
  }

  /** Get the next completion without adding a message to the conversation.
   * @param options Options for getting the completion.
   */
  async getNextCompletion(options?: Partial<GetCompletionOptions>) {
    const opt: GetCompletionOptions = {
      model: this.options.model,
      callFunctions: false,
      ...options,
    };

    let response = await this.openai.createChatCompletion({
      model: opt.model,
      messages: this.messages,
      functions: this.getRegisteredFunctions(),
    });

    if (opt.callFunctions) {
      if (response.data.choices[0].message?.function_call) {
        const message = await this.getFunctionMessage(
          response.data.choices[0].message?.function_call!.name!,
          response.data.choices[0].message?.function_call!.arguments!
        );
        this.messages.push(message);
        // TODO: this can call until token limit, set a max depth?
        response = await this.getNextCompletion(opt);
      }
    }

    if (response.data.usage) {
      this.usage = response.data.usage;
    }

    return response;
  }

  /** Add a message to the conversation.
   * @param message The message to add.
   */
  addMessage(message: ChatCompletionRequestMessage) {
    this.messages.push(message);
    this.usage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
  }

  /** Add a system message to the conversation.
   * @param message The message to add.
   */
  addSystemMessage(message: string) {
    this.addMessage({
      role: 'system',
      content: message,
    });
  }

  /** Clear all messages.
   *
   */
  clearMessages() {
    this.messages = [];
    this.usage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
  }
}
