<script lang="ts">
  import { page } from "$app/state";
  import { onMount, tick } from "svelte";
  import type { Action } from "svelte/action";
  import { fade } from "svelte/transition";
  import { source } from "sveltekit-sse";

  let socket = $state<WebSocket>();

  let players = $state<Client[]>();

  let client = $state<Client>();

  let all_messages = $state<{
    from: Client["name"],
    message: string
  }[]>([]);

  type Client = {
    position: Position,
    name: string
    messages: Message[],
  };


  let current_time = $state(Date.now());
  setInterval(() => {
    current_time = Date.now();
  }, 1000);

  const arrow_keys = $derived({
    up: undefined as HTMLButtonElement|undefined,
    down: undefined as HTMLButtonElement|undefined,
    left: undefined as HTMLButtonElement|undefined,
    right: undefined as HTMLButtonElement|undefined
  });

  let input_message: HTMLTextAreaElement|undefined = $state();
  let games_display_elem: HTMLDivElement|undefined = $state();
  let games_container_elem: HTMLDivElement|undefined = $state();
  let games_controls_elem: HTMLDivElement|undefined = $state();
  let game_chat_elem: HTMLDivElement|undefined = $state();
   
  const emulate_keydown = (key: string) => { 
    if(keys_down.indexOf(key) === -1) keys_down.push(key);
    keys_up.splice(keys_up.indexOf(key), 1);
  };
  const emulate_keyup = (key: string) => {
    if(keys_up.indexOf(key) === -1) keys_up.push(key);
    keys_down.splice(keys_down.indexOf(key), 1);
  };

	const emulate_key: Action<HTMLButtonElement, { key: string }|undefined> = (node: HTMLButtonElement, args: { key: string }|undefined) => {
    const key = String(args?.key);

    node.addEventListener("mousedown", () => emulate_keydown(key));
    document.addEventListener("mouseup", () => emulate_keyup(key));
    node.addEventListener("touchstart", () => emulate_keydown(key));
    document.addEventListener("touchend", () => emulate_keyup(key));
  };  


  //https://stackoverflow.com/a/59435080
  const overlap = (a: HTMLElement, b: HTMLElement) => {
    const rect1 = a.getBoundingClientRect();
    const rect2 = b.getBoundingClientRect();
    const isInHoriztonalBounds =
      rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x;
    const isInVerticalBounds =
      rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y;
    const isOverlapping = isInHoriztonalBounds && isInVerticalBounds;
    return isOverlapping;
  }

  const get_position = (item: HTMLElement): Position => {
    const rect = item.getBoundingClientRect();
    const parentRect = item.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 };

    return {
      x: rect.left - parentRect.left,
      y: rect.top - parentRect.top
    };
  }
  
  const get_size = (item: HTMLElement): Size => {
    const bounding = item.getBoundingClientRect();
    const width = bounding.width;
    const height = bounding.height;

    return { width, height };
  }

  type Position = {
    x: number,
    y: number,
  };

  type Size = {
    width: number,
    height: number,
  }

  type Message = {
    sent: number,
    text: string
  }

  class PlayerCharacter {
    element: HTMLDivElement|undefined;
    
    messages: Message[] = $state([]);

    position: Position = $state({ x: 0, y: 0 });
    collisions: Set<HTMLElement> = new Set();
    
    constructor(element: typeof this.element) {
      this.element = element;
    }

    collision_help(position: Position) {
      if(this.collisions.size > 0) {
        this.collisions.forEach((collider) => {
          if(!this.element) return;
          if(!collider.classList.contains("solid")) return;

          const player_size = get_size(this.element);

          const collider_pos = get_position(collider);
          const collider_size = get_size(collider);

          //oughh my bwain

          const overlap_x = (position.x + player_size.width) - collider_pos.x;
          const _overlap_x = (collider_pos.x + collider_size.width) - position.x;
          const overlap_y = (position.y + player_size.height) - collider_pos.y;
          const _overlap_y = (collider_pos.y + collider_size.height) - position.y;

          const delta_x = (overlap_x < _overlap_x ? -overlap_x : _overlap_x);
          const delta_y = (overlap_y < _overlap_y ? -overlap_y : _overlap_y);

          const is_overlapping =
            position.x < collider_pos.x + collider_size.width &&
            position.x + player_size.width > collider_pos.x &&
            position.y < collider_pos.y + collider_size.height &&
            position.y + player_size.height > collider_pos.y;

          if(!is_overlapping) return;

          if(Math.abs(delta_x) < Math.abs(delta_y)) {
            position.x += delta_x;
          } else {
            position.y += delta_y;
          }
        });
      }
      return position;
    }

    client_move(_position: Partial<Position>, rounded: boolean = false) {
      if(!this.element) return;

      let position = {
        y: _position.y || this.position.y,
        x: _position.x || this.position.x
      } as Position;

      const display_bounding = games_display_elem?.getBoundingClientRect();
      const player_bounding = this.element.getBoundingClientRect();

      const border_left = games_display_elem ? parseFloat(getComputedStyle(games_display_elem).getPropertyValue("border-left-width")) *2 : 0;
      const border_top = games_display_elem ? parseFloat(getComputedStyle(games_display_elem).getPropertyValue("border-top-width")) *2 : 0;

      this.collisions.clear();

      const all_items = games_display_elem?.querySelectorAll("*");
      all_items?.values().forEach((item) => {
        if(item === this.element) return;
        if(!item.classList.contains("collidable")) return;
        const collided = overlap(this.element as HTMLElement, item as HTMLElement);
        if(collided) this.collisions.add(item as HTMLElement);
      });

      if(position.x && display_bounding) {
        if(position.x < 0) return;
        const width = display_bounding.width - border_left - player_bounding.width;
        if(position.x >= width) {
          position.x = width;
        };
      }
      if(position.y && display_bounding) {
        if(position.y < 0) return;
        const height = display_bounding.height - border_top - player_bounding.height
        if(position.y >= height) {
          position.y = height;
        };
      }

      position = this.collision_help(position);

      this.position.x = position.x ?? this.position.x;
      this.position.y = position.y ?? this.position.y;
      
      this.element.style.top = `${this.position.y}px`;
      this.element.style.left = `${this.position.x}px`;

      socket?.send(JSON.stringify({
        type: "position",

        position: this.position
      }))
      
      return;
    }

    up(y: number) {
      this.client_move({ y: this.position.y - y }, true);
    }
    down(y: number) {
      this.client_move({ y: this.position.y + y }, true);
    }
    left(x: number) {
      this.client_move({ x: this.position.x - x }, true);
    }
    right(x: number) {
      this.client_move({ x: this.position.x + x }, true);
    }
  }

  const CharacterSpeeds = {
    WALK: 2,
    SPRINT: 5
  }

  class YouCharacter extends PlayerCharacter {
    speed: number = $state(CharacterSpeeds.WALK);
  }


  let you_elem: HTMLDivElement|undefined = $state();
  // svelte-ignore non_reactive_update
  let you = $state(new YouCharacter(undefined));
  
  let keys_down = $state<string[]>([]);
  let keys_up = $state<string[]>([]);

  onMount(() => {
    socket = new WebSocket(`wss://${page.url.host}/api/game`);

    console.log("aaaaa:3");
    socket.addEventListener("open", async (e) => {
      console.log("opened", e)
    });
    socket.addEventListener("message", async (e) => {
      console.log(e.data)
      try {
        const data = JSON.parse(e.data);

        if(data) {
          if(data.type === "this_client") {
            client = data.client;
            you = new YouCharacter(you_elem);
          }

          if(data.type === "players") {
            // create instances for players yk
            players = data.players;
          }

          if(data.type === "messages") {
            let auto_scroll = false;

            if(
              game_chat_elem 
                && 
              Math.abs(game_chat_elem.scrollHeight - game_chat_elem.scrollTop - game_chat_elem.clientHeight) < 1
            ) auto_scroll = true;

            all_messages.push({
              message: data.message,
              from: data.from
            })
            
            await tick();
            if(auto_scroll && game_chat_elem) game_chat_elem.scroll({ top: game_chat_elem.scrollHeight, behavior: 'smooth' });
          }
        }
      } catch(e) {};
    })

    if(games_container_elem) {
      document.addEventListener("keyup", (event) => {
        const current_key = event.key;
        keys_down.splice(keys_down.indexOf(current_key), 1)
        console.log("e", performance.now(), current_key)

        if(keys_up.indexOf(current_key) === -1) keys_up.push(current_key);
      });

      document.addEventListener("keydown", (event) => {

        const active = document.activeElement;
        const body_focused = active && !(
          active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA"
        );

        if(!body_focused) return;

        const current_key = event.key;
        if(keys_down.indexOf(current_key) === -1) keys_down.push(current_key);
        console.log(performance.now(), current_key)

        keys_up.splice(keys_up.indexOf(current_key), 1);
      }); 

        // const create_combo = (combos: Set<string>|string[]) => Array.from(combos).sort().join("+");
        // // Key or Key1+Key2
        // switch(Array.from(keys_down).sort().join("+")) {
        //   case create_combo(["h", "e", "l", "o"]): 
        //     console.log("hello faggot.");
        //     break;
        // }
    }

    return () => {
      socket?.close();
    }
  });

  setInterval(() => {

  // single
  keys_down.forEach((key) => {
    switch(key.toLowerCase()) {
      case "shift": 
        you.speed = CharacterSpeeds.SPRINT;
        break;
      case "arrowup":
      case "w": 
        arrow_keys.up?.classList.add("active");

        you.up(you.speed);
        break;
      case "arrowdown": 
      case "s": 
        arrow_keys.down?.classList.add("active");

        you.down(you.speed);
        break;
      case "arrowleft": 
      case "a": 
        arrow_keys.left?.classList.add("active");

        you.left(you.speed);
        break;
      case "arrowright": 
      case "d": 
        arrow_keys.right?.classList.add("active");

        you.right(you.speed);
        break;
      case "t": 
        input_message?.focus();
        break;
    }
  });

  keys_up.forEach((key) => {
    switch(key.toLowerCase()) {
      case "shift": 
        you.speed = CharacterSpeeds.WALK;
        break;
      case "arrowup":
      case "w": 
        arrow_keys.up?.classList.remove("active");
        break;
      case "arrowdown": 
      case "s": 
        arrow_keys.down?.classList.remove("active");
        break;
      case "arrowleft": 
      case "a": 
        arrow_keys.left?.classList.remove("active");
        break;
      case "arrowright": 
      case "d": 
        arrow_keys.right?.classList.remove("active");
        break;
    }
    keys_up.splice(keys_up.indexOf(key), 1);
  });

  }, 30);

  // wow!
  var crc32=function(r: any){for(var a,o=[],c=0;c<256;c++){a=c;for(var f=0;f<8;f++)a=1&a?3988292384^a>>>1:a>>>1;o[c]=a}for(var n=-1,t=0;t<r.length;t++)n=n>>>8^o[255&(n^r.charCodeAt(t))];return(-1^n)>>>0};

  const name_to_color = (t: any) => `hsl(${crc32(String(t)) % 360}deg, 74%, 84%)`; 
</script>

<div class="game-row">
<div bind:this={games_container_elem} class="game-container" tabindex="-1">
  <div bind:this={games_display_elem} class="game-display">
    <div class="block collidable solid"></div>


    {#each players ?? [] as player}
    {#if player.name !== client?.name}
    <div class="char style-1" style:top={`${player.position.y}px`} style:z-index={Number(players?.indexOf(player)) + 1} style:background={name_to_color(player?.name)} style:left={`${player.position.x}px`}>
      <div class="username">{player.name}</div>
      <div class="messages">
        {#each player.messages ?? [] as message}
          {#if (current_time - message.sent) <= 10000}<div transition:fade class="message"><div class="pad">{message.text}</div></div>{/if}
        {/each}
      </div>
    </div>
    {/if}
    {/each}
    
    <div bind:this={you_elem} class="char style-1 you" style:z-index={client ? Number(players?.indexOf(client)) + 1 : 1} style:background={name_to_color(client?.name)}>
      <div class="username">{client?.name}</div>
      <div class="messages">
        {#each you.messages ?? [] as message}
          {#if (current_time - message.sent) <= 10000}<div transition:fade class="message"><div class="pad">{message.text}</div></div>{/if}
        {/each}
      </div>
    </div>

  </div>

  <div bind:this={games_controls_elem} class="game-controls">
    <textarea style:width="100%" style:resize="none"
    placeholder="press T to chat" bind:this={input_message} onkeydown={async (e) => { if(e.key == "Enter") {
      e.preventDefault();

      const target = (e.target as HTMLInputElement);

      let value = target.value.trim();

      // do this also on the server
      await (async () => {
        if(value.length === 0) return;
        if(value.length >= 50) return alert("your message exceeds 50 characters.");
        
        you.messages.push({
          sent: Date.now(),
          text: value
        });

        socket?.send(JSON.stringify({
          type: "message",

          message: {
            text: value
          }
        }))
        target.value = "";
        target.blur();

        games_container_elem?.focus();
      })();
    } }}></textarea>
    <div class="game-controls-wasd">
      <!-- svelte-ignore a11y_consider_explicit_label -->
      <button class="bi bi-arrow-up up" 
        bind:this={arrow_keys.up}
        use:emulate_key={{ key: "ArrowUp" }}></button>
      <div class="another-row">
      <!-- svelte-ignore a11y_consider_explicit_label -->
      <button class="bi bi-arrow-left left" 
        bind:this={arrow_keys.left}
        use:emulate_key={{ key: "ArrowLeft" }}></button>
      <!-- svelte-ignore a11y_consider_explicit_label -->
      <button class="bi bi-arrow-down down" 
        bind:this={arrow_keys.down}
        use:emulate_key={{ key: "ArrowDown" }}></button>
      <!-- svelte-ignore a11y_consider_explicit_label -->
      <button class="bi bi-arrow-right right" 
        bind:this={arrow_keys.right}
        use:emulate_key={{ key: "ArrowRight" }}></button>
      </div>
    </div>
  </div>
</div>

<div class="game-side">
  <div>players</div>
  <div class="game-players">
    {#each players ?? [] as player}
    <div>
      <div class="box"
      style:width="16px" style:height="16px" 
      style:background={name_to_color(player?.name)}></div>

      <div style:color={name_to_color(player?.name)} 
      style:font-weight={player?.name === client?.name ? "600" : "unset"}>{player.name}</div>
    </div>
    {/each}
  </div>

  <div>chat</div>
  <div class="game-chat" bind:this={game_chat_elem}>
    {#each all_messages as message}
      <div>
        <div class="box"
        style:width="16px" style:height="16px" 
        style:background={name_to_color(message.from)}></div>
        <div class="username"
        style:color={name_to_color(message.from)} 
        style:font-weight={message.from === client?.name ? "600" : "unset"}>{message.from}</div> 
        <div class="message">{message.message}</div>
      </div>
    {/each}
  </div>
</div>

</div>

{#if !(socket?.OPEN && client)}
<div class="loading-screen">
  <div class="colon-three">:3</div>
  <div class="status">connecting to WebSocket...</div>
  <div>
    SOCKET_OPEN: {socket?.OPEN}<br>
    CLIENT: {JSON.stringify(client ?? {})}<br>
    PLAYERS: {JSON.stringify(players ?? {})} 
  </div>
</div>
{/if} 

<style lang="scss">
  * {
    user-select: none;
  }
  .game-side {
    display: flex;
    flex-direction: column;
    
    gap: 0.5em;
    width: 15em;
  }
  .game-players {
    display: flex;
    flex-direction: column;
    border: #333 solid 1px;
    max-height: 10em;

    flex: 1;

    overflow-y: scroll;

    & > * {
      display: flex;
      flex-direction: row;
      align-items: center;

      padding: 5px;
      gap: 5px;
      &:nth-child(odd) {
        background: #0a0a0a;
      }
      &:nth-child(even) {
        background: #1a1a1a;
      }
    }
  }
  .game-chat {
    display: flex;
    flex-direction: column;

    border: #333 solid 1px;

    max-height: 20em;

    overflow-y: scroll;

    flex: 1;

    & > * {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;

      padding: 5px;
      gap: 5px;

      & .username {
        color: #dddddd;
      }

      & .message {
        word-break: break-all;
        word-wrap: break-word;
      }

      &:nth-child(odd) {
        background: #0a0a0a;
      }
      &:nth-child(even) {
        background: #1a1a1a;
      }
    }
  }

  .game-row {
    display: flex;
    flex-direction: row;
    gap: 0.5em;

    margin: auto;
  }

  .loading-screen {
    position: fixed;
    width: 100%;
    height: 100%;
    
    z-index: 10000;

    backdrop-filter: blur(5px);

    background: rgba(0, 0, 0, 0.5);

    display: flex;
    flex-direction: column;

    margin: auto;
    justify-content: center;
    align-items: center;

    .colon-three {
      & {
        margin: 10px;
        font-size: 2.5em;
        border-radius: 100%;
        animation: speen 5s linear 0s infinite forwards;
        @keyframes speen {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      }
    }
  }

  .game-container {
    margin: auto;
    min-width: 500px;
  }

  .game-controls {
    padding: 5px 0;
    
    justify-content: center;

    gap: 5px;

    display: flex;
    flex-direction: row;

    & .game-controls-wasd {
      display: flex;
      flex-direction: column;
      align-items: center;

      & .another-row {
        display: flex;
        flex-direction: row;
      }
    }
  }

  .game-display {
    position: relative;
    aspect-ratio: 4/3;

    border: #333 solid 1px;
    overflow: hidden;

    box-sizing: border-box;

    & .block {
      position: absolute;
      top: 50px;
      left: 50px;
      
      width: 25px;
      height: 25px;

      background: #26ff00;
    }

    & .char {
      position: absolute;
      top: 0;
      bottom: 0;

      width: 25px;
      height: 25px;

      & .username {
        color: #dddddd;
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);

        font-size: 10px;

        z-index: 10;
      }
      
      & .messages {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);

        overflow: hidden;

        display: flex;
        flex-direction: column;
        gap: 0.25em;

        z-index: 9;
        & .message {
          text-align: left;

          max-height: 4em;
          overflow: scroll;

          max-width: 10em;
          min-width: 6em;
          
          border-radius: 1px;

          font-size: 14px;
          color: #000;
          background: #fff;
          & .pad { 
            padding: 2px;
          }

          margin-bottom: 5px;
        }
      }

      &.style-1 {
        background: #ffffff;
      }

      &.you {
        & .username {
          font-weight: 600;
          color: #fff;
        }
      }
    }
  }
</style>