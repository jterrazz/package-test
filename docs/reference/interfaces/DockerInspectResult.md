# Interface: DockerInspectResult

Defined in: [infrastructure/docker/docker-port.ts:21](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-port.ts#L21)

## Properties

### config

```ts
config: object;
```

Defined in: [infrastructure/docker/docker-port.ts:29](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-port.ts#L29)

#### env

```ts
env: string[];
```

#### image

```ts
image: string;
```

***

### hostConfig

```ts
hostConfig: object;
```

Defined in: [infrastructure/docker/docker-port.ts:33](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-port.ts#L33)

#### cpuQuota

```ts
cpuQuota: number;
```

#### memory

```ts
memory: number;
```

#### mounts

```ts
mounts: object[];
```

#### networkMode

```ts
networkMode: string;
```

***

### id

```ts
id: string;
```

Defined in: [infrastructure/docker/docker-port.ts:22](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-port.ts#L22)

***

### name

```ts
name: string;
```

Defined in: [infrastructure/docker/docker-port.ts:23](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-port.ts#L23)

***

### networkSettings

```ts
networkSettings: object;
```

Defined in: [infrastructure/docker/docker-port.ts:43](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-port.ts#L43)

#### networks

```ts
networks: Record<string, {
  gateway: string;
  ipAddress: string;
}>;
```

***

### state

```ts
state: object;
```

Defined in: [infrastructure/docker/docker-port.ts:24](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-port.ts#L24)

#### exitCode

```ts
exitCode: number;
```

#### running

```ts
running: boolean;
```

#### status

```ts
status: string;
```
