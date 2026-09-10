# se-eu-fosse-voce-eu-nao-entrava-aqui

Sistema experimental de videochamadas baseado em WebRTC.

## Recursos

- Videochamada
- Áudio
- Câmera
- Microfone
- Compartilhamento de tela
- Vários participantes
- Chat
- Transferência de arquivos
- Interface responsiva
- Compatível com computadores, celulares e tablets modernos

## Usuários

Antes de entrar na sala, o usuário precisa passar pela tela de acesso e escolher:

- Ravi
- Iuri
- Outro

## Tecnologias

- HTML
- CSS
- JavaScript
- WebRTC
- PeerJS

## Execução

O projeto pode ser hospedado no GitHub Pages.

É necessário acessar o site usando HTTPS para que recursos como câmera, microfone e compartilhamento de tela funcionem corretamente.

## Segurança

A senha não é armazenada diretamente em texto no JavaScript. O código contém apenas um hash SHA-256.

Isso não deve ser considerado um sistema de autenticação de alta segurança, pois o frontend é público e executado no dispositivo do usuário.

Para segurança real, o projeto deverá posteriormente utilizar autenticação no servidor.

## Arquitetura

A transmissão de áudio, vídeo, tela e arquivos utiliza conexões WebRTC entre os participantes.

Esta versão utiliza uma arquitetura mesh, portanto o consumo de banda aumenta conforme o número de participantes.

Para grupos maiores, a arquitetura recomendada é utilizar um servidor SFU.