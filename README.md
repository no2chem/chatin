# Chatin

Chatin is a functions plugin interface for chatbots such as ChatGPT.

Chatin simplifies the development of tools leveraging chatbots by providing a
simple decorator-based interface for developing chat functions. It also
provides a controller for managing chat interactions.

An example of a "system" plugin is provided in `example_plugin.ts`, and
example usage can be found in `example_usage.ts`.

Plugins are defined in a class, and functions exposed to the chatbot
are decorated with descriptions that are passed to the chatbot:

```typescript
export class SystemPlugin {

    /** Fetch a URL and return raw text. */
    @ChatFunction({
        name: "fetch",
        description: "Fetch a URL and return raw text"
    })
    async chatFetch(
        @ChatParameter({
            description: "The URL to fetch",
            type: "string",
            required: true
        }) url: string) {
        return await (await fetch(url)).text();
    }
    ...
}
```

Your application can then register the plugin, which will be passed to the
bot during a conversation:

```typescript
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
```

While Chatin is currently tied to OpenAI's ChatGPT API, the plan would
be to decouple this in the future so existing plugins could be used
by any chatbot in the future.