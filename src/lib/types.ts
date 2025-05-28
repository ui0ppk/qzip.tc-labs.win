type Position = { 
  x: number,
  y: number
}
type Message = {
  sent: number,
  text: string
}

type Client = { 
  id: string,

  name: string,
  position: Position
  messages: Message[]
}