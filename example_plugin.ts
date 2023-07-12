import {ChatFunction, ChatParameter} from './chatin';

/**
 * Example "system" plugin.
 */
export class SystemPlugin {
  /** Retrieve the current date and time. */
  @ChatFunction({
    name: 'date_time',
    description: 'Get the current date and time.',
  })
  dateTime() {
    return `${new Date().toString()}`;
  }

  /** Fetch a URL and return raw text. */
  @ChatFunction({
    name: 'fetch',
    description: 'Fetch a URL and return raw text',
  })
  async chatFetch(
    @ChatParameter({
      description: 'The URL to fetch',
      type: 'string',
      required: true,
    })
    url: string
  ) {
    return await (await fetch(url)).text();
  }
}
