<script lang="ts">
    import {
        Card,
        CardHeader,
        CardBody,
        Form,
        FormGroup,
        Label,
        Input,
        Button,
        Icon
    } from "sveltestrap";
    import { signin } from "@/stores/user";
    import { _ } from "@/i18n";
    import { goto } from "@roxi/routify";
    $goto

    let username: string;
    let setOTPScreen: boolean = $state(false);
    let password: string;
    let isError: boolean;
    let showPassword: boolean = false;

    async function handleSubmit(event: Event) {
        event.preventDefault();
        setOTPScreen = true;
        // isError = false;
    }
    async function handleOTPSubmit(event: Event) {
        event.preventDefault();
        isError = false;
        try {
            await signin(username, password);
            $goto("/dashboard");
        } catch (error) {
            isError = true;
        }
    }
</script>


<div class="container-fluid d-flex flex-column justify-content-center align-items-center vh-100" id="login-container">
    <h1 class="text-center">Catalogue</h1>
    <Card class="w-25 p-4 mt-5">
        <CardBody>
            {#if setOTPScreen === false}
            <Form on:submit={handleSubmit}>
                <FormGroup>
                    <Label for="username">Email or Mobile phone</Label>
                    <Input
                        class={isError ? "border-danger" : ""}
                        type="text"
                        name="username"
                        bind:value={username}
                        required
                    />
                    <div class="mt-4">
                        <Button type="submit" color="dark" class="w-100">Login</Button>
                    </div>
                </FormGroup>
            </Form>
            {:else}
                <Form on:submit={handleOTPSubmit}>
                    <FormGroup>
                        <Label for="username">
                            We have sent you a code to {username} Insert here
                        </Label>
                        <Input
                            class={isError ? "border-danger" : ""}
                            type="text"
                            name="password"
                            bind:value={password}
                            required
                        />
                        {#if isError}
                            <p class="text-danger">Wrong credentials!</p>
                        {/if}
                        <div class="mt-4">
                            <Button type="submit" color="dark" class="w-100">Submit</Button>
                        </div>
                    </FormGroup>
                </Form>
            {/if}
        </CardBody>
    </Card>
</div>


<style>
    .input-group {
        display: flex;
        align-items: center;
    }
    .input-group-text {
        background: none;
        border: none;
    }
    #login-container {
        height: 100vh;
    }
</style>