# Oauth Book

Based on the sample application built in the book '[OAuth 2 in Action][1]' by Justin Richer and Antonio Sanso (Manning).

## Prerequisites

- Node.js 14

## Getting started

1. Clone this repository.
1. Open a terminal in the `src` directory.
1. Generate a certificate (`server.crt`) with private key (`server.key`) ([How-to][2])
1. Run `npm install`.
1. Run `node authorization-server/app.js`.
1. Open a new terminal in the `src` directory.
1. Run `node protected-resource/app.js`.
1. Open a new terminal in the `src` directory.
1. Run `node client/app.js`.
1. Open a new web browser tab for each URL.
    1. <https://localhost:9001/>
    1. <https://localhost:9002/>
    1. <https://localhost:9000/>

## License

[MIT License](./LICENSE)

Copyright &copy; 2023 Felipe Romero

[1]: https://www.manning.com/books/oauth-2-in-action
[2]: https://gist.github.com/feliperomero3/a6282b0e7ca579fff0e296227675190d
