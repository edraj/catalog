<script>
    import {Nav, Navbar, NavbarBrand, NavItem, NavLink} from "sveltestrap";
    import SearchBar from "@/routes/components/SearchBar.svelte";
</script>

<Navbar color="light" light expand="md">
    <NavbarBrand href="/">Catalog</NavbarBrand>
    <Nav class="ml-auto" navbar>
        <NavItem>
            <SearchBar />
        </NavItem>
        <NavItem>
            <NavLink href="#">
                <i class="bi bi-bell-fill"></i>
            </NavLink>
        </NavItem>
        <NavItem>
            <NavLink href="/me">
                <i class="bi bi-person-circle"></i>
            </NavLink>
        </NavItem>
    </Nav>
</Navbar>