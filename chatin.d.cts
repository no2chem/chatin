import * as axios from 'axios';
import * as openai from 'openai';
import { OpenAIApi, CreateCompletionResponseUsage, ChatCompletionRequestMessage, ChatCompletionFunctions } from 'openai';

/**
 * Decorator for a chat function.
 *
 * @param data.name         Name of the function passsed to GPT.
 * @param data.description  Description of the function passed to GPT.
 */
declare function ChatFunction(data: {
  name: string;
  description: string;
}): (target: any, propertyKey: string, descriptor?: PropertyDescriptor) => void;
/**
 * Decorator for a chat function paramter.
 *
 * @param   data.description  Description of the parameter passed to GPT.
 * @param   data.type         Type of the parameter passed to GPT, either "string" or "object".
 * @param   data.required     Whether the parameter is required or not.
 */
declare function ChatParameter(data: {
  description: string;
  type: 'string' | 'object';
  required?: boolean;
}): (target: any, propertyKey: string, parameterIndex: number) => void;
/** Options for retrieving a function message */
interface GetFunctionMessageOptions {
  /** The maximum number of tokens to request. */
  requestMaxTokens: number;
}
/** Options for getting message completions. */
interface GetCompletionOptions {
  model: string;
}
/** Options for the chat functions controller. */
interface ChatFunctionsControllerOptions {
  model: string;
}
/** Data stored for each chat function */
interface ChatFunctionData {
  description: string;
  parameterData: any[];
  parameterRequired: string[];
  parameterIndex: Map<string, number>;
  func: (...args: any[]) => any;
}
/** Options for registering functions */
interface RegisterFunctionsOptions {
  namespace?: string;
  enable: string[];
}
/** Controller for chat functions */
declare class ChatFunctionsController {
  openai: OpenAIApi;
  registeredFunctionsMap: Map<string, ChatFunctionData>;
  enabledFunctions: string[];
  usage: CreateCompletionResponseUsage;
  messages: Array<ChatCompletionRequestMessage>;
  options: ChatFunctionsControllerOptions;
  /** Constructor.
   * @param openai The OpenAI API.
   * @param options Options for the controller.
   */
  constructor(
    openai: OpenAIApi,
    options?: Partial<ChatFunctionsControllerOptions>
  );
  /** Register a new plugin with function decorators.
   * @param plugin The plugin to register.
   * @param options Options for registering the plugin.
   */
  registerFunctions(
    plugin: any,
    options?: Partial<RegisterFunctionsOptions>
  ): void;
  /** Get registered functions.
   * @returns An array of registered functions.
   */
  getRegisteredFunctions(): ChatCompletionFunctions[];
  /** Handle a request for a function.
   * @param name The name of the function.
   * @param args The arguments to the function.
   *
   * @returns The response from the function.
   */
  handleFunctionCall(name: string, args: string): Promise<string>;
  /** Enable a function by name.
   * @param name The name of the function to enable.
   */
  enableFunction(name: string): void;
  /** Disable a function by name.
   * @param name The name of the function to disable.
   */
  disableFunction(name: string): void;
  /** Enable multiple functions by name.
   * @param names The names of the functions to enable.
   * @see enableFunction
   */
  enableFunctions(...names: string[]): void;
  /** Disable multiple functions by name.
   * @param names The names of the functions to disable.
   * @see disableFunction
   */
  disableFunctions(...names: string[]): void;
  defaultFunctionMessageOptions: GetFunctionMessageOptions;
  /** Get a function message from a message.
   * @param message The message to get the function message from.
   * @param options Options for getting the function message.
   *
   * @returns The function message.
   */
  getFunctionMessageFromMessage(
    message: ChatCompletionRequestMessage,
    options?: Partial<GetFunctionMessageOptions>
  ): Promise<ChatCompletionRequestMessage>;
  /** Get a function message from a function name and arguments.
   * @param name The name of the function.
   * @param args The arguments to the function.
   * @param options Options for getting the function message.
   *
   * @returns The function message.
   */
  getFunctionMessage(
    name: string,
    args: string,
    options?: Partial<GetFunctionMessageOptions>
  ): Promise<ChatCompletionRequestMessage>;
  /** Get a completion with a message.
   * @param message The message to get the completion with.
   * @param options Options for getting the completion.
   */
  getCompletionWithMessage(
    message: ChatCompletionRequestMessage,
    options?: Partial<GetCompletionOptions>
  ): Promise<axios.AxiosResponse<openai.CreateChatCompletionResponse, any>>;
  /** Get the next completion without adding a message to the conversation.
   * @param options Options for getting the completion.
   */
  getNextCompletion(
    options?: Partial<GetCompletionOptions>
  ): Promise<axios.AxiosResponse<openai.CreateChatCompletionResponse, any>>;
  /** Add a message to the conversation.
   * @param message The message to add.
   */
  addMessage(message: ChatCompletionRequestMessage): void;
  /** Add a system message to the conversation.
   * @param message The message to add.
   */
  addSystemMessage(message: string): void;
  /** Clear all messages.
   *
   */
  clearMessages(): void;
}

export { ChatFunction, ChatFunctionData, ChatFunctionsController, ChatFunctionsControllerOptions, ChatParameter, GetCompletionOptions, GetFunctionMessageOptions };
