import { ChatFunctionsController } from './chatin';
import { SystemPlugin } from './example_plugin';
import { Configuration,  OpenAIApi } from 'openai';

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);
const controller = new ChatFunctionsController(openai);
const plugin = new SystemPlugin();

controller.registerFunctions(plugin, { enable : ['date_time', 'fetch'] });

controller.addSystemMessage("You are helpful chatbot who uses functions to answer user questions.");

let completion = await controller.getCompletionWithMessage({
    role: 'user',
    content: "Who is the current president of the United States?"
})

console.log(completion.data.choices[0].message);