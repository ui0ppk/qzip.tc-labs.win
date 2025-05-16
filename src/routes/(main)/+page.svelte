<script lang="ts">
  import { onMount } from "svelte";
    import { fade } from "svelte/transition";
  import { source } from "sveltekit-sse";
  const api = source("/api/colon-three");
  let count = api.select("count");

  let colon_three: HTMLButtonElement|undefined = $state();

  const count_up = async () => await fetch(`/api/colon-three`);

  let addeds: number[] = $state([]);
  count.subscribe(() => {
    const value = Date.now();
    addeds.push(value);

    setTimeout(() => addeds.splice(addeds.indexOf(value), 1), 1500)
  });

  // onMount(() => {
  //   if(colon_three) colon_three.addEventListener("animationend", async (event) => { 
  //     await fetch(`/api/colon-three`);
  //   })
  // });

  const random_messages = [
    "meow",
    "nya",
    "Ass",

    "ur stinky",
    "sponsored by my rpi",
    "i ran out of things to say"
  ];

  let footer_text = $state("");
  let footer_text_updating = false;
  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const fetch_new_footer_text = async () => {
    if(footer_text_updating) return;
    footer_text_updating = true;

    let footer_text_arr = footer_text.split(""); 
    for(let index = footer_text.length - 1; index >= 0; index--) {
      footer_text_arr[index] = "";
      footer_text = footer_text_arr.join("")
      await sleep(100);
    }
    await sleep(150);

    let txt_arr = random_messages[Math.floor(Math.random() * random_messages.length)].split("");
    for(let index = 0; index < txt_arr.length; index++) {
      footer_text += txt_arr[index];
      await sleep(100);
    }

    footer_text_updating = false;
  }

  fetch_new_footer_text();
  setInterval(async () => await fetch_new_footer_text(), 15000)

</script>

<div class="center-me"> 
  <button class="colon-three reset"
  bind:this={colon_three} onclick={() => { count_up(); }}>
    <div class="parent-text">
      <div class="text">:3</div>
    </div>
    <div class="count">{$count == "" ? "-" : new Intl.NumberFormat("en-US", { }).format(Number($count))} click{Number($count) == 1 ? "" : "s"}</div>

    <div class="addeds">
    <!-- (added) is used as the "key" -->
    {#each addeds as added (added)}
      {@const rnd_pct = () => Math.floor((Math.random() * 100))}
      <div transition:fade class="added" style:left={`${rnd_pct()}%`} style:top={`${rnd_pct()}%`}>+1</div>
    {/each}
    </div>
  </button>
</div>

<div class="footer">{footer_text}</div>

<style lang="scss">
  .addeds {
    position: absolute;

    height: 75vh;
    width: 80vw;
  }

  .added {
    position: absolute;
    font-size: 0.8em;
    color: #55e564;
  }

  .center-me {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .footer {
    font-size: 0.775em;
    text-align: center;
    color: #cacaca;

    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translate(-50%, 0%);
    padding-bottom: 0.5em;
  }

  .colon-three {
    background: none;
    border: 0;
    color: #fff;
    height: 100vh;
    width: 100vw;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    & .parent-text {
      display: flex;
      align-items: center;
      min-height: 3em;
    }

    & .text {
      transition: font-size ease-out 0.2s;

      font-size: 1.5em;
    }

    & .count {
      color: #cacaca;
      font-size: 0.775em;
    }

    &:active .text {
      font-size: 2.5em;
    }
  }
</style>